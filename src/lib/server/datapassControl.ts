import { env } from "$env/dynamic/private";
import { adaptLegacyGlobalWorkspace, detectControlPersistenceMode } from "$lib/datapass/legacyGlobalAdapter";
import { buildSeedWorkspace, workspaceExportSchema, type WorkspaceExport } from "$lib/datapass/workspaceSchema";
import { getMongo } from "$lib/server/mongo";
import type { Db, Document, Filter, Sort } from "mongodb";

const DEFAULT_QUERY_LIMIT = 1000;

const collections = {
	projects: "projects",
	workItems: "work_items",
	agentNodes: "agent_nodes",
	instructionProfiles: "instruction_profiles",
	savedQueries: "saved_queries",
	sources: "source_catalog",
	reports: "report_catalog",
	workspacePresets: "workspace_presets",
	systemNodes: "system_nodes",
	systemEdges: "system_edges",
} as const;

const allowedQueryCollections = new Set<string>(Object.values(collections));
const forbiddenQueryKeys = new Set(["$out", "$merge", "$where", "$function", "$accumulator"]);
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

function withoutMongoId(doc: Document): Record<string, unknown> {
	const copy: Record<string, unknown> = { ...doc };
	delete copy._id;
	return copy;
}

export async function getControlDb(): Promise<Db> {
	if (env.DATAPASS_CONTROL_DISABLED === "true") {
		throw new Error("Datapass control database is disabled");
	}

	const mongo = await getMongo();
	const clients = mongo.listClients();

	if (clients.length === 0) {
		throw new Error("No MongoDB connections are configured");
	}

	const requested = env.DATAPASS_CONTROL_SERVER;
	if (!requested || !env.DATAPASS_CONTROL_DATABASE) {
		throw new Error(
			"App-owned control persistence requires explicit DATAPASS_CONTROL_SERVER and DATAPASS_CONTROL_DATABASE. No control database is created implicitly.",
		);
	}
	const selected = clients.find((entry) => entry.name === requested || entry._id === requested);

	if (!selected) {
		throw new Error("Configured Datapass control MongoDB server was not found");
	}

	await selected.client.connect();
	return selected.client.db(env.DATAPASS_CONTROL_DATABASE);
}

async function readCollection(db: Db, name: string): Promise<Record<string, unknown>[]> {
	const docs = await db.collection(name).find({}).toArray();
	return docs.map(withoutMongoId);
}

async function controlCollectionNames(db: Db): Promise<Set<string>> {
	const rows = await db.listCollections({}, { nameOnly: true }).toArray();
	return new Set(rows.map((row) => row.name));
}

function seedWorkspace(
	sourceMode: "seed-empty" | "seed-disabled" | "fallback-error",
	controlDatabase?: string,
	warning?: string,
): WorkspaceExport {
	const seed = buildSeedWorkspace();
	return {
		...seed,
		metadata: {
			...seed.metadata,
			source: "seed",
			sourceMode,
			controlDatabase,
			warning,
		},
	};
}

function safeWarning(error: unknown): string {
	const message = error instanceof Error ? error.message : "Unknown control database error";
	return message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, "[redacted-mongodb-uri]").slice(0, 500);
}

export async function loadControlWorkspace(): Promise<WorkspaceExport> {
	if (env.DATAPASS_CONTROL_DISABLED === "true") {
		return seedWorkspace("seed-disabled");
	}

	try {
		const db = await getControlDb();
		const names = await controlCollectionNames(db);
		const mode = detectControlPersistenceMode(names);

		if (mode === "legacy-global") {
			const [entityRows, legacyWorkItemRows] = await Promise.all([
				readCollection(db, "entities"),
				readCollection(db, "work_items"),
			]);
			const adapted = adaptLegacyGlobalWorkspace(entityRows, legacyWorkItemRows);
			const seed = buildSeedWorkspace();

			return workspaceExportSchema.parse({
				...seed,
				metadata: {
					...seed.metadata,
					source: "mongo",
					sourceMode: "legacy-adapter",
					controlDatabase: db.databaseName,
				},
				projects: adapted.projects,
				workItems: adapted.workItems,
				agentNodes: [],
				instructionProfiles: [],
				savedQueries: [],
			});
		}

		if (mode === "empty-or-unknown") {
			return seedWorkspace("seed-empty", db.databaseName);
		}

		const projectDocs = await readCollection(db, collections.projects);
		const seed = buildSeedWorkspace();
		const [
			workItems,
			agentNodes,
			instructionProfiles,
			savedQueries,
			sources,
			reports,
			workspacePresets,
			systemNodes,
			systemEdges,
		] = await Promise.all([
			readCollection(db, collections.workItems),
			readCollection(db, collections.agentNodes),
			readCollection(db, collections.instructionProfiles),
			readCollection(db, collections.savedQueries),
			readCollection(db, collections.sources),
			readCollection(db, collections.reports),
			readCollection(db, collections.workspacePresets),
			readCollection(db, collections.systemNodes),
			readCollection(db, collections.systemEdges),
		]);

		return workspaceExportSchema.parse({
			schemaVersion: 1,
			metadata: {
				name: "Datapass Mongo Control",
				source: "mongo",
				sourceMode: "workspace-v1",
				exportedAt: new Date().toISOString(),
				controlDatabase: db.databaseName,
			},
			projects: projectDocs,
			workItems,
			agentNodes,
			instructionProfiles,
			savedQueries,
			sources: sources.length > 0 ? sources : seed.sources,
			reports: reports.length > 0 ? reports : seed.reports,
			workspacePresets: workspacePresets.length > 0 ? workspacePresets : seed.workspacePresets,
			systemNodes,
			systemEdges,
		});
	} catch (error) {
		return seedWorkspace("fallback-error", env.DATAPASS_CONTROL_DATABASE, safeWarning(error));
	}
}

async function upsertMany(db: Db, collectionName: string, docs: Array<{ id: string }>) {
	if (docs.length === 0) {
		return;
	}

	await db.collection(collectionName).bulkWrite(
		docs.map((doc) => ({
			replaceOne: {
				filter: { id: doc.id },
				replacement: doc,
				upsert: true,
			},
		})),
	);
}

export function controlWritesEnabled(): boolean {
	return (
		env.DATAPASS_CONTROL_DISABLED !== "true" &&
		env.DATAPASS_CONTROL_WRITE_ENABLED === "true" &&
		!!env.DATAPASS_CONTROL_SERVER &&
		!!env.DATAPASS_CONTROL_DATABASE &&
		env.MONGOKU_READ_ONLY_MODE !== "true"
	);
}

export async function saveControlWorkspace(workspace: WorkspaceExport, mode: "merge" | "replace"): Promise<void> {
	const parsed = workspaceExportSchema.parse(workspace);
	const db = await getControlDb();
	const persistenceMode = detectControlPersistenceMode(await controlCollectionNames(db));

	if (persistenceMode === "legacy-global") {
		throw new Error(
			"Legacy DATAPASSCONTROL graph is read-only through the compatibility adapter. Initialize a workspace-v1 namespace explicitly before using workspace writes.",
		);
	}

	if (mode === "replace") {
		await Promise.all(Object.values(collections).map((collectionName) => db.collection(collectionName).deleteMany({})));
	}

	await Promise.all([
		upsertMany(db, collections.projects, parsed.projects),
		upsertMany(db, collections.workItems, parsed.workItems),
		upsertMany(db, collections.agentNodes, parsed.agentNodes),
		upsertMany(db, collections.instructionProfiles, parsed.instructionProfiles),
		upsertMany(db, collections.savedQueries, parsed.savedQueries),
		upsertMany(db, collections.sources, parsed.sources),
		upsertMany(db, collections.reports, parsed.reports),
		upsertMany(db, collections.workspacePresets, parsed.workspacePresets),
		upsertMany(db, collections.systemNodes, parsed.systemNodes),
		upsertMany(
			db,
			collections.systemEdges,
			parsed.systemEdges.map((edge, index) => ({
				id: edge.from + "::" + edge.to + "::" + index,
				...edge,
			})),
		),
	]);
}

function substituteParameters(value: unknown, parameters: Record<string, unknown>): unknown {
	if (typeof value === "string") {
		const match = value.match(/^\{\{([A-Za-z0-9_-]+)\}\}$/);
		if (match) {
			const parameterName = match[1];
			if (!(parameterName in parameters)) {
				throw new Error("Missing query parameter: " + parameterName);
			}
			return parameters[parameterName];
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
			throw new Error("Forbidden operator in saved control query: " + key);
		}
		assertReadOnlyQuery(nested);
	}
}

function assertAllowedPipeline(pipeline: unknown): asserts pipeline is Document[] {
	if (!Array.isArray(pipeline)) {
		throw new Error("Saved aggregation pipeline must be an array");
	}

	for (const stage of pipeline) {
		if (!stage || typeof stage !== "object" || Array.isArray(stage)) {
			throw new Error("Each aggregation stage must be an object");
		}

		const keys = Object.keys(stage);
		if (keys.length !== 1 || !allowedAggregationStages.has(keys[0])) {
			throw new Error("Aggregation stage is not allowed in saved control queries: " + keys.join(", "));
		}
	}
}

export async function executeSavedControlQuery(
	queryId: string,
	parameters: Record<string, unknown> = {},
): Promise<Record<string, unknown>[]> {
	const workspace = await loadControlWorkspace();
	const query = workspace.savedQueries.find((candidate) => candidate.id === queryId);

	if (!query) {
		throw new Error("Saved control query not found: " + queryId);
	}

	if (!query.readOnly) {
		throw new Error("Only read-only saved control queries can be executed");
	}

	if (!allowedQueryCollections.has(query.collection)) {
		throw new Error("Saved query targets a non-control collection");
	}

	const db = await getControlDb();
	const collection = db.collection(query.collection);
	const limit = Math.min(query.limit ?? DEFAULT_QUERY_LIMIT, DEFAULT_QUERY_LIMIT);

	if (query.operation === "find") {
		const filter = substituteParameters(query.filter ?? {}, parameters);
		assertReadOnlyQuery(filter);

		let cursor = collection.find(filter as Filter<Document>);
		if (query.sort) {
			cursor = cursor.sort(query.sort as Sort);
		}
		cursor = cursor.limit(limit);

		return (await cursor.toArray()).map(withoutMongoId);
	}

	const pipeline = substituteParameters(query.pipeline ?? [], parameters);
	assertReadOnlyQuery(pipeline);
	assertAllowedPipeline(pipeline);

	const stages = pipeline;
	if (query.limit) {
		stages.push({ $limit: limit });
	}

	return (await collection.aggregate(stages, { maxTimeMS: 5000 }).toArray()).map(withoutMongoId);
}
