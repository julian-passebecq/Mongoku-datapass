import { env } from "$env/dynamic/private";
import {
	getReportDefinition,
	getSourceDescriptor,
	type ReportDefinition,
	type ReportQueryStep,
	type ReportResult,
	type ReportSection,
	type ReportSectionMeta,
	type ReportSourceTrace,
	type ResourceRegistryTrace,
	type SourceDescriptor,
} from "$lib/datapass/reporting";
import { applyReportSemantics, normalizeReportLimit } from "$lib/datapass/reportSemantics";
import type { WorkspaceExport } from "$lib/datapass/workspaceSchema";
import { loadControlWorkspace } from "$lib/server/datapassControl";
import { getMongo } from "$lib/server/mongo";
import type { Collection, Document, Filter, MongoClient, Sort } from "mongodb";

type SourceBinding = {
	server: string;
	database?: string;
};

type RegistryResolution = {
	trace: ResourceRegistryTrace;
	database?: string;
};

type ResolvedMongoSource = {
	client: MongoClient;
	database: string;
	server: string;
	resourceRegistry?: ResourceRegistryTrace;
};

type ExecutionContext = {
	workspace: WorkspaceExport;
	sourceBindings: Record<string, SourceBinding>;
	resourceBindings: Record<string, SourceBinding>;
	registryCache: Map<string, Promise<RegistryResolution | undefined>>;
	sourceCache: Map<string, Promise<ResolvedMongoSource | null>>;
};

const DEFAULT_QUERY_LIMIT = 500;
const MAX_QUERY_LIMIT = 500;
const QUERY_TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 1_500_000;

const allowedAggregationStages = new Set([
	"$match",
	"$group",
	"$sort",
	"$project",
	"$limit",
	"$skip",
	"$unwind",
	"$count",
	"$addFields",
	"$set",
	"$unset",
	"$replaceWith",
	"$replaceRoot",
]);
const forbiddenQueryKeys = new Set(["$out", "$merge", "$where", "$function", "$accumulator"]);

function parseBindings(value: string | undefined): Record<string, SourceBinding> {
	if (!value) {
		return {};
	}
	try {
		const parsed = JSON.parse(value) as Record<string, SourceBinding>;
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch {
		return {};
	}
}

async function createExecutionContext(): Promise<ExecutionContext> {
	return {
		workspace: await loadControlWorkspace(),
		sourceBindings: parseBindings(env.DATAPASS_SOURCE_BINDINGS),
		resourceBindings: parseBindings(env.DATAPASS_RESOURCE_BINDINGS),
		registryCache: new Map(),
		sourceCache: new Map(),
	};
}

function envBinding(sourceId: string): SourceBinding | undefined {
	const key = "DATAPASS_SOURCE_" + sourceId.replace(/[^A-Z0-9_]/gi, "_").toUpperCase() + "_SERVER";
	const server = env[key];
	return server ? { server } : undefined;
}

function configuredBinding(source: SourceDescriptor, context: ExecutionContext): SourceBinding | undefined {
	return context.resourceBindings[source.resourceRef] ?? context.sourceBindings[source.id] ?? envBinding(source.id);
}

function substituteParameters(value: unknown, parameters: Record<string, unknown>): unknown {
	if (typeof value === "string") {
		const match = value.match(/^\{\{([A-Za-z0-9_-]+)\}\}$/);
		if (match) {
			const name = match[1];
			if (!(name in parameters)) {
				throw new Error("Missing report parameter: " + name);
			}
			return parameters[name];
		}
		return value;
	}
	if (Array.isArray(value)) {
		return value.map((item) => substituteParameters(item, parameters));
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, nested]) => [key, substituteParameters(nested, parameters)]),
		);
	}
	return value;
}

function assertReadOnlyQuery(value: unknown): void {
	if (Array.isArray(value)) {
		for (const item of value) {
			assertReadOnlyQuery(item);
		}
		return;
	}
	if (!value || typeof value !== "object") {
		return;
	}
	for (const [key, nested] of Object.entries(value)) {
		if (forbiddenQueryKeys.has(key)) {
			throw new Error("Forbidden operator in report query: " + key);
		}
		assertReadOnlyQuery(nested);
	}
}

function assertAllowedPipeline(pipeline: unknown): asserts pipeline is Document[] {
	if (!Array.isArray(pipeline)) {
		throw new Error("Aggregation pipeline must be an array");
	}
	for (const stage of pipeline) {
		if (!stage || typeof stage !== "object" || Array.isArray(stage)) {
			throw new Error("Each aggregation stage must be an object");
		}
		const keys = Object.keys(stage);
		if (keys.length !== 1 || !allowedAggregationStages.has(keys[0])) {
			throw new Error("Aggregation stage is not allowed in report queries: " + keys.join(", "));
		}
	}
}

function limitsFor(step: ReportQueryStep): { requestedLimit: number; effectiveLimit: number } {
	return normalizeReportLimit(step.limit, DEFAULT_QUERY_LIMIT, MAX_QUERY_LIMIT);
}

function byteLength(value: unknown): number {
	return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function finalizeRows(
	reportId: string,
	step: ReportQueryStep,
	rawRows: Record<string, unknown>[],
	requestedLimit: number,
	effectiveLimit: number,
): { rows: Record<string, unknown>[]; meta: ReportSectionMeta } {
	const semanticRows = applyReportSemantics(reportId, step.id, step.collection, rawRows);
	const rows: Record<string, unknown>[] = [];
	let responseBytes = 0;
	let truncated = semanticRows.length > effectiveLimit;

	for (const row of semanticRows) {
		if (rows.length >= effectiveLimit) {
			truncated = true;
			break;
		}
		const rowBytes = byteLength(row);
		if (responseBytes + rowBytes > MAX_RESPONSE_BYTES) {
			truncated = true;
			break;
		}
		rows.push(row);
		responseBytes += rowBytes;
	}

	return {
		rows,
		meta: {
			state: truncated ? "TRUNCATED" : rows.length === 0 ? "EMPTY" : "OK",
			requestedLimit,
			effectiveLimit,
			returnedRows: rows.length,
			responseBytes,
			truncated,
		},
	};
}

function emptyMeta(state: ReportSectionMeta["state"]): ReportSectionMeta {
	return {
		state,
		returnedRows: 0,
		responseBytes: 0,
		truncated: false,
	};
}

function traceFor(
	reportId: string,
	step: ReportQueryStep,
	source: SourceDescriptor,
	database: string | undefined,
	resolved: boolean,
	message?: string,
	resourceRegistry?: ResourceRegistryTrace,
): ReportSourceTrace {
	return {
		reportId,
		stepId: step.id,
		sourceId: source.id,
		authority: step.authority || source.authority,
		resourceRef: source.resourceRef,
		provider: source.provider,
		database,
		collection: step.collection,
		operation: step.operation,
		readOnly: true,
		resolved,
		resourceRegistry,
		message,
	};
}

function stringValue(row: Record<string, unknown> | undefined, ...keys: string[]): string | undefined {
	if (!row) {
		return undefined;
	}
	for (const key of keys) {
		const value = row[key];
		if (typeof value === "string" && value.trim()) {
			return value;
		}
	}
	return undefined;
}

function stringList(row: Record<string, unknown>, key: string): string[] {
	const value = row[key];
	return Array.isArray(value) ? value.map(String) : [];
}

function kindMatches(row: Record<string, unknown> | undefined, token: string): boolean {
	return !!row && stringValue(row, "kind")?.toUpperCase().includes(token) === true;
}

async function registryParent(
	collection: Collection<Document>,
	row: Record<string, unknown> | undefined,
): Promise<Record<string, unknown> | undefined> {
	const parentId = stringValue(row, "parentResourceId");
	if (!parentId) {
		return undefined;
	}
	const parent = await collection.findOne({ _id: parentId } as Filter<Document>);
	return parent ? ({ ...parent } as Record<string, unknown>) : undefined;
}

async function resolveRegistryRecord(
	source: SourceDescriptor,
	context: ExecutionContext,
): Promise<RegistryResolution | undefined> {
	if (!source.registryAuthority || source.id === "FOIL_PM") {
		return undefined;
	}

	const cached = context.registryCache.get(source.id);
	if (cached) {
		return cached;
	}

	const promise = (async (): Promise<RegistryResolution> => {
		const pmSource =
			context.workspace.sources.find((candidate) => candidate.id === "FOIL_PM") ?? getSourceDescriptor("FOIL_PM");
		if (!pmSource) {
			return { trace: { found: false, registryAuthority: source.registryAuthority! } };
		}

		const pmBinding = configuredBinding(pmSource, context);
		if (!pmBinding) {
			return { trace: { found: false, registryAuthority: source.registryAuthority! } };
		}

		const mongo = await getMongo();
		const selected = mongo
			.listClients()
			.find((entry) => entry.name === pmBinding.server || entry._id === pmBinding.server);
		if (!selected) {
			return { trace: { found: false, registryAuthority: source.registryAuthority! } };
		}

		const pmDatabase = pmBinding.database ?? pmSource.database;
		if (!pmDatabase) {
			return { trace: { found: false, registryAuthority: source.registryAuthority! } };
		}

		await selected.client.connect();
		const registry = selected.client.db(pmDatabase).collection("resource_registry");

		let matches = await registry
			.find({ _id: source.resourceRef } as Filter<Document>)
			.limit(2)
			.toArray();

		if (matches.length === 0 && source.database) {
			matches = await registry
				.find({
					provider: source.provider,
					kind: { $regex: "DATABASE", $options: "i" },
					name: source.database,
				})
				.limit(3)
				.toArray();
		}

		if (matches.length === 0) {
			const aliases = source.aliases ?? [];
			const names = Array.from(new Set([source.authority, ...aliases]));
			matches = await registry
				.find({
					provider: source.provider,
					$or: [
						{ canonicalAuthorityName: { $in: names } },
						{ canonicalName: { $in: names } },
						{ recommendedDisplayName: { $in: names } },
						{ name: { $in: names } },
						{ aliases: { $in: names } },
					],
				})
				.limit(3)
				.toArray();
		}

		if (matches.length > 1) {
			throw new Error("REGISTRY_AMBIGUOUS: multiple FOIL PM resource_registry records match " + source.id);
		}
		if (matches.length === 0) {
			return { trace: { found: false, registryAuthority: source.registryAuthority! } };
		}

		const row = { ...matches[0] } as Record<string, unknown>;
		const parent1 = await registryParent(registry, row);
		const parent2 = await registryParent(registry, parent1);
		const parent3 = await registryParent(registry, parent2);
		const lineage = [row, parent1, parent2, parent3].filter(
			(candidate): candidate is Record<string, unknown> => !!candidate,
		);

		const databaseRow = lineage.find((candidate) => kindMatches(candidate, "DATABASE"));
		const clusterRow = lineage.find((candidate) => kindMatches(candidate, "CLUSTER"));
		const projectRow = lineage.find((candidate) => kindMatches(candidate, "PROJECT"));
		const repositoryRow = lineage.find((candidate) => kindMatches(candidate, "REPOSITORY"));

		const database =
			stringValue(databaseRow, "database", "databaseName", "dbName") ??
			(databaseRow ? stringValue(databaseRow, "name") : undefined);

		const rowKind = stringValue(row, "kind")?.toUpperCase() ?? "";
		const rowExternalId = stringValue(row, "externalId");
		const projectId =
			stringValue(projectRow, "projectId", "externalId") ??
			(rowKind.includes("PROJECT") || rowKind.includes("REASONING_AUTHORITY")
				? (stringValue(row, "projectId") ?? rowExternalId)
				: undefined);

		const clusterId =
			stringValue(clusterRow, "clusterId", "externalId") ??
			(rowKind.includes("CLUSTER") ? (stringValue(row, "clusterId") ?? rowExternalId) : undefined);

		const repositoryId =
			stringValue(repositoryRow, "externalId") ?? (rowKind.includes("REPOSITORY") ? rowExternalId : undefined);

		return {
			database,
			trace: {
				found: true,
				registryAuthority: source.registryAuthority!,
				resourceId: stringValue(row, "_id", "resourceId", "id") ?? source.resourceRef,
				canonicalName:
					stringValue(row, "canonicalAuthorityName", "recommendedDisplayName", "canonicalName") ??
					(kindMatches(row, "DATABASE") ? source.authority : stringValue(row, "name")) ??
					source.authority,
				providerName: stringValue(row, "providerName", "atlasProjectName", "displayName", "name") ?? source.authority,
				aliases: Array.from(new Set([...(source.aliases ?? []), ...stringList(row, "aliases")])),
				resourceKind: stringValue(row, "kind", "resourceKind"),
				authorityRole: stringValue(row, "role", "authorityRole", "scope"),
				provider: stringValue(row, "provider"),
				projectId,
				cluster: stringValue(clusterRow, "clusterName", "name") ?? stringValue(row, "clusterName"),
				clusterId,
				database,
				repository: stringValue(repositoryRow, "name", "repository", "repositoryName", "repo"),
				repositoryId,
				providerResourceId: rowExternalId,
				status: stringValue(row, "status"),
				defaultRoute: typeof row.defaultRoute === "boolean" ? row.defaultRoute : undefined,
				lastVerifiedAt: stringValue(row, "verifiedAt", "lastVerifiedAt", "lastVerified"),
			},
		};
	})();

	context.registryCache.set(source.id, promise);
	return promise;
}

async function resolveMongoSource(
	source: SourceDescriptor,
	context: ExecutionContext,
): Promise<ResolvedMongoSource | null> {
	const cached = context.sourceCache.get(source.id);
	if (cached) {
		return cached;
	}

	const promise = (async (): Promise<ResolvedMongoSource | null> => {
		const registry = await resolveRegistryRecord(source, context);
		if (source.registryAuthority && source.id !== "FOIL_PM" && !registry?.trace.found) {
			throw new Error("REGISTRY_UNAVAILABLE: FOIL PM resource_registry did not resolve canonical source " + source.id);
		}

		const binding = configuredBinding(source, context);
		if (!binding) {
			return null;
		}

		const mongo = await getMongo();
		const selected = mongo.listClients().find((entry) => entry.name === binding.server || entry._id === binding.server);
		if (!selected) {
			throw new Error("SOURCE_UNAVAILABLE: configured source server was not found for " + source.id);
		}

		const registeredDatabase = registry?.database;
		if (registeredDatabase && source.database && registeredDatabase !== source.database) {
			throw new Error(
				"NAMESPACE_MISMATCH: source catalog expects " +
					source.database +
					" but FOIL PM registered " +
					registeredDatabase,
			);
		}

		const expectedDatabase = registeredDatabase ?? source.database;
		if (binding.database && expectedDatabase && binding.database !== expectedDatabase) {
			throw new Error(
				"NAMESPACE_MISMATCH: private binding points to " +
					binding.database +
					" but canonical namespace is " +
					expectedDatabase,
			);
		}

		const database = expectedDatabase ?? binding.database;
		if (!database) {
			throw new Error("NAMESPACE_UNRESOLVED: no canonical database is registered for " + source.id);
		}

		await selected.client.connect();
		return {
			client: selected.client,
			database,
			server: selected.name,
			resourceRegistry: registry?.trace,
		};
	})();

	context.sourceCache.set(source.id, promise);
	return promise;
}

function errorState(message: string, registry?: ResourceRegistryTrace): ReportSectionMeta["state"] {
	if (/REGISTRY_UNAVAILABLE|REGISTRY_AMBIGUOUS|NAMESPACE_MISMATCH|NAMESPACE_UNRESOLVED/.test(message)) {
		return "REGISTRY_UNAVAILABLE";
	}
	if (/SOURCE_UNAVAILABLE/.test(message)) {
		return "SOURCE_UNBOUND";
	}
	if (registry?.found) {
		return "REGISTERED_UNBOUND";
	}
	return "SOURCE_ERROR";
}

async function executeStep(
	context: ExecutionContext,
	reportId: string,
	step: ReportQueryStep,
	parameters: Record<string, unknown>,
): Promise<ReportSection> {
	const source =
		context.workspace.sources.find((candidate) => candidate.id === step.sourceId) ?? getSourceDescriptor(step.sourceId);
	if (!source) {
		throw new Error("Unknown source: " + step.sourceId);
	}
	if (source.adapter !== "MONGODB") {
		throw new Error("Unsupported source adapter: " + source.adapter);
	}

	let registry: RegistryResolution | undefined;
	let resolved: ResolvedMongoSource | null;
	try {
		registry = await resolveRegistryRecord(source, context);
		resolved = await resolveMongoSource(source, context);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Source resolution failed";
		if (!step.optional && !/REGISTRY_|NAMESPACE_|SOURCE_UNAVAILABLE/.test(message)) {
			throw error;
		}
		return {
			id: step.id,
			label: step.label,
			authority: step.authority,
			sourceId: step.sourceId,
			rows: [],
			trace: traceFor(reportId, step, source, source.database, false, message, registry?.trace),
			meta: emptyMeta(errorState(message, registry?.trace)),
		};
	}

	if (!resolved) {
		const registered = registry?.trace.found === true;
		const message =
			(registered
				? "PM resource_registry resolved this canonical resource, but no private server binding is configured. "
				: "") +
			"Bind it through DATAPASS_RESOURCE_BINDINGS, DATAPASS_SOURCE_BINDINGS or DATAPASS_SOURCE_" +
			source.id +
			"_SERVER.";
		return {
			id: step.id,
			label: step.label,
			authority: step.authority,
			sourceId: step.sourceId,
			rows: [],
			trace: traceFor(reportId, step, source, source.database, false, message, registry?.trace),
			meta: emptyMeta(registered ? "REGISTERED_UNBOUND" : "SOURCE_UNBOUND"),
		};
	}

	const { requestedLimit, effectiveLimit } = limitsFor(step);
	const collection = resolved.client.db(resolved.database).collection(step.collection);

	try {
		if (step.operation === "find") {
			const filter = substituteParameters(step.filter ?? {}, parameters);
			const projection = substituteParameters(step.projection ?? {}, parameters);
			assertReadOnlyQuery(filter);
			assertReadOnlyQuery(projection);

			let cursor = collection.find(filter as Filter<Document>, { maxTimeMS: QUERY_TIMEOUT_MS });
			if (step.projection && Object.keys(step.projection).length > 0) {
				cursor = cursor.project(projection as Document);
			}
			if (step.sort) {
				cursor = cursor.sort(step.sort as Sort);
			}
			cursor = cursor.limit(effectiveLimit + 1);
			const rawRows = (await cursor.toArray()).map((row) => ({ ...row }) as Record<string, unknown>);
			const finalized = finalizeRows(reportId, step, rawRows, requestedLimit, effectiveLimit);
			return {
				id: step.id,
				label: step.label,
				authority: step.authority,
				sourceId: step.sourceId,
				rows: finalized.rows,
				trace: traceFor(reportId, step, source, resolved.database, true, undefined, resolved.resourceRegistry),
				meta: finalized.meta,
			};
		}

		const pipeline = substituteParameters(step.pipeline ?? [], parameters);
		assertReadOnlyQuery(pipeline);
		assertAllowedPipeline(pipeline);
		const stages = [...pipeline, { $limit: effectiveLimit + 1 }];
		const rawRows = (await collection.aggregate(stages, { maxTimeMS: QUERY_TIMEOUT_MS }).toArray()).map(
			(row) => ({ ...row }) as Record<string, unknown>,
		);
		const finalized = finalizeRows(reportId, step, rawRows, requestedLimit, effectiveLimit);

		return {
			id: step.id,
			label: step.label,
			authority: step.authority,
			sourceId: step.sourceId,
			rows: finalized.rows,
			trace: traceFor(reportId, step, source, resolved.database, true, undefined, resolved.resourceRegistry),
			meta: finalized.meta,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Report query failed";
		if (step.optional || /NamespaceNotFound|ns not found|does not exist/i.test(message)) {
			return {
				id: step.id,
				label: step.label,
				authority: step.authority,
				sourceId: step.sourceId,
				rows: [],
				trace: traceFor(reportId, step, source, resolved.database, false, message, resolved.resourceRegistry),
				meta: emptyMeta("SOURCE_ERROR"),
			};
		}
		throw error;
	}
}

async function executeReportWithContext(
	context: ExecutionContext,
	reportId: string,
	parameters: Record<string, unknown> = {},
): Promise<ReportResult> {
	const current = new Date();
	const runtimeParameters: Record<string, unknown> = {
		today: current.toISOString().slice(0, 10),
		now: current.toISOString(),
		...parameters,
	};
	const report: ReportDefinition | undefined =
		context.workspace.reports.find((candidate) => candidate.id === reportId) ?? getReportDefinition(reportId);
	if (!report) {
		throw new Error("Unknown report: " + reportId);
	}

	const sections: ReportSection[] = [];
	for (const step of report.steps) {
		sections.push(await executeStep(context, report.id, step, runtimeParameters));
	}

	return {
		reportId: report.id,
		title: report.title,
		description: report.description,
		presentation: report.presentation,
		generatedAt: new Date().toISOString(),
		readOnly: true,
		sections,
	};
}

export async function executeSourceQuery(
	step: ReportQueryStep,
	parameters: Record<string, unknown> = {},
	reportId = "AD_HOC",
): Promise<ReportSection> {
	const context = await createExecutionContext();
	return executeStep(context, reportId, step, parameters);
}

export async function executeReport(reportId: string, parameters: Record<string, unknown> = {}): Promise<ReportResult> {
	const context = await createExecutionContext();
	return executeReportWithContext(context, reportId, parameters);
}

export async function executeReports(
	reportIds: string[],
	parameters: Record<string, unknown> = {},
): Promise<ReportResult[]> {
	const context = await createExecutionContext();
	const results: ReportResult[] = [];
	for (const reportId of reportIds) {
		try {
			results.push(await executeReportWithContext(context, reportId, parameters));
		} catch (error) {
			const report =
				context.workspace.reports.find((candidate) => candidate.id === reportId) ?? getReportDefinition(reportId);
			if (!report) {
				continue;
			}
			const message = error instanceof Error ? error.message : "Report failed";
			results.push({
				reportId,
				title: report.title,
				description: report.description,
				presentation: report.presentation,
				generatedAt: new Date().toISOString(),
				readOnly: true,
				sections: [
					{
						id: "report-error",
						label: "Unavailable",
						authority: "Mongoku report engine",
						sourceId: "UNRESOLVED",
						rows: [],
						trace: {
							reportId,
							stepId: "report-error",
							sourceId: "UNRESOLVED",
							authority: "Mongoku report engine",
							resourceRef: "UNRESOLVED",
							provider: "MONGODB_ATLAS",
							collection: "",
							operation: "find",
							readOnly: true,
							resolved: false,
							message,
						},
						meta: emptyMeta("SOURCE_ERROR"),
					},
				],
			});
		}
	}
	return results;
}
