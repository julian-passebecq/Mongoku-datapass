import { env } from "$env/dynamic/private";
import { buildSeedWorkspace, workspaceExportSchema, type WorkspaceExport } from "$lib/datapass/workspaceSchema";
import { getMongo } from "$lib/server/mongo";
import type { Db, Document } from "mongodb";

const DEFAULT_DATABASE = "datapass_control";

const collections = {
	projects: "projects",
	workItems: "work_items",
	agentNodes: "agent_nodes",
	instructionProfiles: "instruction_profiles",
	savedQueries: "saved_queries",
	systemNodes: "system_nodes",
	systemEdges: "system_edges"
} as const;

function withoutMongoId<T extends Document>(doc: T): Omit<T, "_id"> {
	const { _id: _ignored, ...rest } = doc;
	return rest;
}

async function getControlDb(): Promise<Db> {
	const mongo = await getMongo();
	const clients = mongo.listClients();

	if (clients.length === 0) {
		throw new Error("No MongoDB connections are configured");
	}

	const requested = env.DATAPASS_CONTROL_SERVER;
	const selected = requested
		? clients.find((entry) => entry.name === requested || entry._id === requested)
		: clients[0];

	if (!selected) {
		throw new Error("Configured Datapass control MongoDB server was not found");
	}

	await selected.client.connect();
	return selected.client.db(env.DATAPASS_CONTROL_DATABASE || DEFAULT_DATABASE);
}

async function readCollection(db: Db, name: string): Promise<Record<string, unknown>[]> {
	const docs = await db.collection(name).find({}).toArray();
	return docs.map((doc) => withoutMongoId(doc) as Record<string, unknown>);
}

export async function loadControlWorkspace(): Promise<WorkspaceExport> {
	try {
		const db = await getControlDb();
		const projectDocs = await readCollection(db, collections.projects);

		if (projectDocs.length === 0) {
			const seed = buildSeedWorkspace();
			return {
				...seed,
				metadata: {
					...seed.metadata,
					source: "seed",
					controlDatabase: db.databaseName
				}
			};
		}

		const [workItems, agentNodes, instructionProfiles, savedQueries, systemNodes, systemEdges] = await Promise.all([
			readCollection(db, collections.workItems),
			readCollection(db, collections.agentNodes),
			readCollection(db, collections.instructionProfiles),
			readCollection(db, collections.savedQueries),
			readCollection(db, collections.systemNodes),
			readCollection(db, collections.systemEdges)
		]);

		return workspaceExportSchema.parse({
			schemaVersion: 1,
			metadata: {
				name: "Datapass Mongo Control",
				source: "mongo",
				exportedAt: new Date().toISOString(),
				controlDatabase: db.databaseName
			},
			projects: projectDocs,
			workItems,
			agentNodes,
			instructionProfiles,
			savedQueries,
			systemNodes,
			systemEdges
		});
	} catch {
		return buildSeedWorkspace();
	}
}

async function upsertMany(db: Db, collectionName: string, docs: Array<{ id: string }>) {
	if (docs.length === 0) return;

	await db.collection(collectionName).bulkWrite(
		docs.map((doc) => ({
			replaceOne: {
				filter: { id: doc.id },
				replacement: doc,
				upsert: true
			}
		}))
	);
}

export function controlWritesEnabled(): boolean {
	return env.DATAPASS_CONTROL_WRITE_ENABLED === "true" && env.MONGOKU_READ_ONLY_MODE !== "true";
}

export async function saveControlWorkspace(workspace: WorkspaceExport, mode: "merge" | "replace"): Promise<void> {
	const parsed = workspaceExportSchema.parse(workspace);
	const db = await getControlDb();

	if (mode === "replace") {
		await Promise.all(Object.values(collections).map((collectionName) => db.collection(collectionName).deleteMany({})));
	}

	await Promise.all([
		upsertMany(db, collections.projects, parsed.projects),
		upsertMany(db, collections.workItems, parsed.workItems),
		upsertMany(db, collections.agentNodes, parsed.agentNodes),
		upsertMany(db, collections.instructionProfiles, parsed.instructionProfiles),
		upsertMany(db, collections.savedQueries, parsed.savedQueries),
		upsertMany(db, collections.systemNodes, parsed.systemNodes),
		upsertMany(db, collections.systemEdges, parsed.systemEdges.map((edge, index) => ({ id: edge.from + "::" + edge.to + "::" + index, ...edge })))
	]);
}
