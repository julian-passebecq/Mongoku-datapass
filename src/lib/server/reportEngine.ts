import { env } from "$env/dynamic/private";
import {
	getReportDefinition,
	getSourceDescriptor,
	type ReportDefinition,
	type ReportQueryStep,
	type ReportResult,
	type ReportSection,
	type ReportSourceTrace,
	type SourceDescriptor
} from "$lib/datapass/reporting";
import { loadControlWorkspace } from "$lib/server/datapassControl";
import { getMongo } from "$lib/server/mongo";
import type { Document, Filter, MongoClient, Sort } from "mongodb";

type SourceBinding = {
	server: string;
	database?: string;
};

const DEFAULT_QUERY_LIMIT = 500;
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
	"$replaceRoot"
]);
const forbiddenQueryKeys = new Set(["$out", "$merge", "$where", "$function", "$accumulator"]);

function parseBindings(): Record<string, SourceBinding> {
	if (!env.DATAPASS_SOURCE_BINDINGS) {
		return {};
	}
	try {
		const parsed = JSON.parse(env.DATAPASS_SOURCE_BINDINGS) as Record<string, SourceBinding>;
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch {
		return {};
	}
}

function envBinding(sourceId: string): SourceBinding | undefined {
	const key = "DATAPASS_SOURCE_" + sourceId.replace(/[^A-Z0-9_]/gi, "_").toUpperCase() + "_SERVER";
	const server = env[key];
	if (!server) {
		return undefined;
	}
	return { server };
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
			Object.entries(value).map(([key, nested]) => [key, substituteParameters(nested, parameters)])
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

function traceFor(
	reportId: string,
	step: ReportQueryStep,
	source: SourceDescriptor,
	database: string | undefined,
	resolved: boolean,
	message?: string
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
		message
	};
}

async function resolveMongoSource(source: SourceDescriptor): Promise<{
	client: MongoClient;
	database: string;
	server: string;
} | null> {
	const binding = parseBindings()[source.id] ?? envBinding(source.id);
	if (!binding) {
		return null;
	}

	const mongo = await getMongo();
	const selected = mongo
		.listClients()
		.find((entry) => entry.name === binding.server || entry._id === binding.server);

	if (!selected) {
		throw new Error("Configured source server was not found for " + source.id);
	}

	const database = binding.database ?? source.database;
	if (!database) {
		throw new Error("No database configured for source " + source.id);
	}

	await selected.client.connect();
	return {
		client: selected.client,
		database,
		server: selected.name
	};
}

async function executeStep(
	reportId: string,
	step: ReportQueryStep,
	parameters: Record<string, unknown>,
	sources?: SourceDescriptor[]
): Promise<ReportSection> {
	const source = sources?.find((candidate) => candidate.id === step.sourceId) ?? getSourceDescriptor(step.sourceId);
	if (!source) {
		throw new Error("Unknown source: " + step.sourceId);
	}

	if (source.adapter !== "MONGODB") {
		throw new Error("Unsupported source adapter: " + source.adapter);
	}

	let resolved: Awaited<ReturnType<typeof resolveMongoSource>>;
	try {
		resolved = await resolveMongoSource(source);
	} catch (error) {
		if (step.optional) {
			const message = error instanceof Error ? error.message : "Source resolution failed";
			return {
				id: step.id,
				label: step.label,
				authority: step.authority,
				sourceId: step.sourceId,
				rows: [],
				trace: traceFor(reportId, step, source, source.database, false, message)
			};
		}
		throw error;
	}

	if (!resolved) {
		return {
			id: step.id,
			label: step.label,
			authority: step.authority,
			sourceId: step.sourceId,
			rows: [],
			trace: traceFor(
				reportId,
				step,
				source,
				source.database,
				false,
				"No server binding configured. Set DATAPASS_SOURCE_BINDINGS or DATAPASS_SOURCE_" +
					source.id +
					"_SERVER."
			)
		};
	}

	const collection = resolved.client.db(resolved.database).collection(step.collection);
	const limit = Math.min(step.limit ?? DEFAULT_QUERY_LIMIT, DEFAULT_QUERY_LIMIT);

	try {
		if (step.operation === "find") {
			const filter = substituteParameters(step.filter ?? {}, parameters);
			const projection = substituteParameters(step.projection ?? {}, parameters);
			assertReadOnlyQuery(filter);
			assertReadOnlyQuery(projection);

			let cursor = collection.find(filter as Filter<Document>);
			if (step.projection && Object.keys(step.projection).length > 0) {
				cursor = cursor.project(projection as Document);
			}
			if (step.sort) {
				cursor = cursor.sort(step.sort as Sort);
			}
			cursor = cursor.limit(limit);
			const rows = (await cursor.toArray()).map((row) => {
				const copy = { ...row } as Record<string, unknown>;
				return copy;
			});

			return {
				id: step.id,
				label: step.label,
				authority: step.authority,
				sourceId: step.sourceId,
				rows,
				trace: traceFor(reportId, step, source, resolved.database, true)
			};
		}

		const pipeline = substituteParameters(step.pipeline ?? [], parameters);
		assertReadOnlyQuery(pipeline);
		assertAllowedPipeline(pipeline);
		const stages = [...pipeline];
		if (!stages.some((stage) => "$limit" in stage)) {
			stages.push({ $limit: limit });
		}

		const rows = (await collection.aggregate(stages, { maxTimeMS: 5000 }).toArray()).map(
			(row) => ({ ...row }) as Record<string, unknown>
		);

		return {
			id: step.id,
			label: step.label,
			authority: step.authority,
			sourceId: step.sourceId,
			rows,
			trace: traceFor(reportId, step, source, resolved.database, true)
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
				trace: traceFor(reportId, step, source, resolved.database, false, message)
			};
		}
		throw error;
	}
}

export async function executeSourceQuery(
	step: ReportQueryStep,
	parameters: Record<string, unknown> = {},
	reportId = "AD_HOC"
): Promise<ReportSection> {
	const workspace = await loadControlWorkspace();
	return executeStep(reportId, step, parameters, workspace.sources);
}

export async function executeReport(
	reportId: string,
	parameters: Record<string, unknown> = {}
): Promise<ReportResult> {
	const current = new Date();
	const runtimeParameters: Record<string, unknown> = {
		today: current.toISOString().slice(0, 10),
		now: current.toISOString(),
		...parameters
	};
	const workspace = await loadControlWorkspace();
	const report: ReportDefinition | undefined =
		workspace.reports.find((candidate) => candidate.id === reportId) ?? getReportDefinition(reportId);
	if (!report) {
		throw new Error("Unknown report: " + reportId);
	}

	const sections: ReportSection[] = [];
	for (const step of report.steps) {
		sections.push(await executeStep(report.id, step, runtimeParameters, workspace.sources));
	}

	return {
		reportId: report.id,
		title: report.title,
		description: report.description,
		presentation: report.presentation,
		generatedAt: new Date().toISOString(),
		readOnly: true,
		sections
	};
}

export async function executeReports(
	reportIds: string[],
	parameters: Record<string, unknown> = {}
): Promise<ReportResult[]> {
	const results: ReportResult[] = [];
	for (const reportId of reportIds) {
		try {
			results.push(await executeReport(reportId, parameters));
		} catch (error) {
			const workspace = await loadControlWorkspace();
			const report = workspace.reports.find((candidate) => candidate.id === reportId) ?? getReportDefinition(reportId);
			if (!report) {
				continue;
			}
			results.push({
				reportId,
				title: report.title,
				description: report.description,
				presentation: report.presentation,
				generatedAt: new Date().toISOString(),
				readOnly: true,
				sections: [{
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
						message: error instanceof Error ? error.message : "Report failed"
					}
				}]
			});
		}
	}
	return results;
}
