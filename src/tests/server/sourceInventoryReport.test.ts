import { beforeEach, describe, expect, it, vi } from "vitest";
import { sourceCatalog, type ReportSection } from "$lib/datapass/reporting";

/**
 * Runs SOURCE_INVENTORY through the real report engine (binding -> PM resource_registry ->
 * resolveMongoSource -> client) against fake Mongo clients that only expose read methods and
 * record every call. Any other property access (insertOne, drop, createIndex, ...) is a forbidden
 * access and fails the test.
 */
const state = vi.hoisted(() => ({
	env: {} as Record<string, string | undefined>,
	clients: [] as Array<{ name: string; _id: string; client: unknown }>,
	calls: [] as string[],
	forbidden: [] as string[],
}));

vi.mock("$env/dynamic/private", () => ({ env: state.env }));
vi.mock("$lib/server/mongo", () => ({ getMongo: async () => ({ listClients: () => state.clients }) }));
vi.mock("$lib/server/datapassControl", () => ({ loadControlWorkspace: async () => ({ sources: [], reports: [] }) }));

const { executeReport } = await import("$lib/server/reportEngine");

const SECRET = "secret-password-never-in-output";
const PM = sourceCatalog.find((source) => source.id === "FOIL_PM")!;

function readOnly<T extends object>(label: string, target: T): T {
	return new Proxy(target, {
		get(object, property) {
			if (typeof property === "symbol" || property === "then") {
				return undefined;
			}
			if (!(property in object)) {
				state.forbidden.push(label + "." + property);
				throw new Error("forbidden access: " + label + "." + property);
			}
			return object[property as keyof T];
		},
	});
}

function cursor(label: string, rows: Record<string, unknown>[]) {
	const self = readOnly(label + ".cursor", {
		project: () => self,
		sort: () => self,
		limit: () => self,
		toArray: async () => rows,
	});
	return self;
}

type Registry = Record<string, unknown>[];

function registryMatches(registry: Registry, query: Record<string, unknown>): Registry {
	if (typeof query._id === "string") {
		return registry.filter((row) => row._id === query._id);
	}
	if (typeof query.name === "string") {
		return registry.filter((row) => row.name === query.name && String(row.kind).includes("DATABASE"));
	}
	return [];
}

function fakeDb(database: string, collections: Record<string, number>, registry: Registry) {
	return readOnly(database, {
		listCollections: () => {
			state.calls.push(database + ".listCollections");
			return readOnly(database + ".listCollections", {
				toArray: async () => Object.keys(collections).map((name) => ({ name, type: "collection" })),
			});
		},
		collection: (name: string) =>
			readOnly(database + "." + name, {
				estimatedDocumentCount: async () => {
					state.calls.push(database + "." + name + ".estimatedDocumentCount");
					return collections[name] ?? 0;
				},
				find: (query: Record<string, unknown>) => {
					state.calls.push(database + "." + name + ".find " + JSON.stringify(query));
					return cursor(database + "." + name, name === "resource_registry" ? registryMatches(registry, query) : []);
				},
				findOne: async (query: Record<string, unknown>) => registryMatches(registry, query)[0] ?? null,
			}),
	});
}

function registryFor(options: { omit?: string[] } = {}): Registry {
	return sourceCatalog
		.filter((source) => source.registryAuthority && source.id !== "FOIL_PM" && !options.omit?.includes(source.id))
		.map((source) =>
			source.id === "FOIL_AI_REASONING"
				? // Live shape: a reasoning-authority record with no DATABASE lineage.
					{
						_id: source.resourceRef,
						kind: "MONGODB_ATLAS_REASONING_AUTHORITY",
						provider: "MONGODB_ATLAS",
						name: "FOIL AI Reasoning",
						clusterName: "ClusterFOILAI",
						database: source.database,
					}
				: { _id: source.resourceRef, kind: "MONGODB_DATABASE", provider: "MONGODB_ATLAS", name: source.database },
		);
}

function setup(options: { unbound?: string[]; unregistered?: string[] } = {}) {
	state.calls.length = 0;
	state.forbidden.length = 0;
	const registry = registryFor({ omit: options.unregistered });
	const bindings: Record<string, { server: string; database?: string }> = {};
	state.clients = sourceCatalog.map((source, index) => {
		const host = source.id.toLowerCase() + ".example.net";
		if (!options.unbound?.includes(source.id)) {
			bindings[source.id] = { server: host, database: source.database };
		}
		const database = source.database ?? source.id;
		return {
			name: host,
			_id: "client-" + index,
			client: readOnly("client:" + host, {
				// Credentials live on the client only; they must never reach the report.
				url: "mongodb+srv://mongoku_readonly:" + SECRET + "@" + host + "/",
				connect: async () => undefined,
				db: (name: string) =>
					fakeDb(name, name === database ? { registry: index + 1, events: 10 * (index + 1) } : {}, registry),
			}),
		};
	});
	state.env.DATAPASS_SOURCE_BINDINGS = JSON.stringify(bindings);
}

const section = (sections: ReportSection[], sourceId: string) =>
	sections.find((candidate) => candidate.sourceId === sourceId)!;

describe("SOURCE_INVENTORY through the report engine", () => {
	beforeEach(() => setup());

	it("returns one resolved inventory section per catalog source", async () => {
		const report = await executeReport("SOURCE_INVENTORY");

		expect(report.sections.map((candidate) => candidate.sourceId)).toEqual(sourceCatalog.map((source) => source.id));
		for (const candidate of report.sections) {
			expect(candidate.meta?.state, candidate.sourceId).toBe("OK");
			expect(candidate.trace.resolved, candidate.sourceId).toBe(true);
			expect(candidate.trace.operation).toBe("inventory");
			expect(candidate.rows.map((row) => row.name)).toEqual(["events", "registry"]);
			expect(candidate.rows.every((row) => row.status === "READABLE")).toBe(true);
		}
		const itDev = section(report.sections, "FOIL_IT_DEV");
		expect(itDev.trace.database).toBe("foil_it_dev");
		expect(itDev.rows.find((row) => row.name === "registry")?.estimatedDocuments).toBeGreaterThan(0);
	});

	it("consults the FOIL PM registry for every FOIL authority, AI Reasoning included", async () => {
		const report = await executeReport("SOURCE_INVENTORY");

		for (const source of sourceCatalog.filter(
			(candidate) => candidate.registryAuthority && candidate.id !== "FOIL_PM",
		)) {
			expect(state.calls).toContain(
				PM.database + ".resource_registry.find " + JSON.stringify({ _id: source.resourceRef }),
			);
			expect(section(report.sections, source.id).trace.resourceRegistry?.found, source.id).toBe(true);
		}
		const ai = section(report.sections, "FOIL_AI_REASONING");
		expect(ai.meta?.state).toBe("OK");
		expect(ai.trace.database).toBe("foil_ai_reasoning");
	});

	it("isolates an unbound or unregistered source without failing the others", async () => {
		setup({ unbound: ["FOIL_FABRIC"], unregistered: ["FOIL_FRONT"] });
		const report = await executeReport("SOURCE_INVENTORY");

		expect(section(report.sections, "FOIL_FABRIC").meta?.state).toBe("REGISTERED_UNBOUND");
		expect(section(report.sections, "FOIL_FRONT").meta?.state).toBe("REGISTRY_UNAVAILABLE");
		const others = report.sections.filter((candidate) => !["FOIL_FABRIC", "FOIL_FRONT"].includes(candidate.sourceId));
		expect(others).toHaveLength(sourceCatalog.length - 2);
		expect(others.every((candidate) => candidate.meta?.state === "OK")).toBe(true);
	});

	it("reports an empty database as EMPTY", async () => {
		const original = state.clients[0];
		state.clients[0] = {
			...original,
			client: readOnly("client:empty", { connect: async () => undefined, db: (name: string) => fakeDb(name, {}, []) }),
		};
		const report = await executeReport("SOURCE_INVENTORY");
		expect(section(report.sections, sourceCatalog[0].id).meta?.state).toBe("EMPTY");
	});

	it("only calls read methods and never exposes a URI or credential", async () => {
		const report = await executeReport("SOURCE_INVENTORY");
		const body = JSON.stringify(report);

		expect(state.forbidden).toEqual([]);
		expect(state.calls.every((call) => /\.(listCollections|estimatedDocumentCount|find) ?/.test(call + " "))).toBe(
			true,
		);
		expect(body).not.toContain(SECRET);
		expect(body).not.toContain("mongodb+srv://");
		expect(body).not.toContain("mongoku_readonly");
	});

	it("leaves find reports on their existing path", async () => {
		const report = await executeReport("FOIL_GLOBAL_REFERENCES");

		expect(report.sections[0].trace.operation).toBe("find");
		expect(state.calls).toContain(
			"dataprojects_control.work_items.find " + JSON.stringify({ project_id: { $regex: "^foil(_|$)" } }),
		);
		expect(state.calls.some((call) => call.includes("listCollections"))).toBe(false);
	});
});
