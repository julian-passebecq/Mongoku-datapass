import { beforeEach, describe, expect, it, vi } from "vitest";
import { workspaceWriteBlockReason } from "$lib/datapass/legacyGlobalAdapter";

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
	env: {} as Record<string, string | undefined>,
	collections: {} as Record<string, Row[]>,
	writes: [] as string[],
	connectError: undefined as Error | undefined,
}));

vi.mock("$env/dynamic/private", () => ({ env: state.env }));

function fakeCollection(name: string) {
	const rows = () => state.collections[name] ?? [];
	const record = (operation: string) => {
		state.writes.push(name + "." + operation);
		return Promise.resolve({ acknowledged: true });
	};
	return {
		find: () => {
			let limit = Infinity;
			const cursor = {
				limit: (value: number) => {
					limit = value;
					return cursor;
				},
				sort: () => cursor,
				toArray: () => Promise.resolve(rows().slice(0, limit)),
			};
			return cursor;
		},
		findOne: () => Promise.resolve(null),
		countDocuments: () => Promise.resolve(rows().length),
		insertOne: () => record("insertOne"),
		updateOne: () => record("updateOne"),
		deleteMany: () => record("deleteMany"),
		bulkWrite: () => record("bulkWrite"),
	};
}

vi.mock("$lib/server/mongo", () => ({
	getMongo: () =>
		Promise.resolve({
			listClients: () => [
				{
					name: "control-host",
					_id: "control-host",
					client: {
						connect: () => (state.connectError ? Promise.reject(state.connectError) : Promise.resolve()),
						db: (databaseName: string) => ({
							databaseName,
							listCollections: () => ({
								toArray: () => Promise.resolve(Object.keys(state.collections).map((name) => ({ name }))),
							}),
							collection: fakeCollection,
						}),
					},
				},
			],
		}),
}));

const { loadControlWorkspace, saveControlWorkspace } = await import("$lib/server/datapassControl");
const { getWorkspaceIdentity, stageControlChangeSet } = await import("$lib/server/datapassHistory");

const liveEntities: Row[] = [
	{
		entity_id: "mongoku_datapass",
		entity_type: "product",
		name: "Mongoku Datapass",
		category: "portfolio_control",
		status: "pr_open_ci_green_runtime_smoke_pending",
		organization_id: "datapass",
	},
	{ entity_id: "foil_hydro", entity_type: "domain", name: "Hydro", status: "stopped", organization_id: "foil" },
];
const liveWork: Row[] = [
	{ work_item_id: "T002", kind: "test", project_id: "mongoku_datapass", status: "partial_green", title: "Partial" },
];

function useLiveGraph(extra: Record<string, Row[]> = {}) {
	state.collections = {
		organizations: [{ organization_id: "datapass", name: "Datapass" }],
		entities: liveEntities,
		work_items: liveWork,
		repositories: [],
		relationships: [],
		events: [],
		audit_runs: [],
		...extra,
	};
}

beforeEach(() => {
	for (const key of Object.keys(state.env)) {
		delete state.env[key];
	}
	Object.assign(state.env, {
		DATAPASS_CONTROL_DISABLED: "false",
		DATAPASS_CONTROL_SERVER: "control-host",
		DATAPASS_CONTROL_DATABASE: "dataprojects_control",
	});
	state.collections = {};
	state.writes = [];
	state.connectError = undefined;
});

describe("control workspace source modes", () => {
	it("renders a populated live graph through the legacy adapter, never the seed", async () => {
		useLiveGraph();
		const workspace = await loadControlWorkspace();

		expect(workspace.metadata.sourceMode).toBe("legacy-adapter");
		expect(workspace.metadata.source).toBe("mongo");
		expect(workspace.projects.map((project) => project.id)).toEqual(["mongoku_datapass", "foil_hydro"]);
		expect(workspace.projects.some((project) => project.id === "datapass-studio")).toBe(false);
	});

	it("keeps working when a preset's default project (legacy `foil`) is not in the live graph", async () => {
		useLiveGraph();
		const workspace = await loadControlWorkspace();

		expect(workspace.projects.some((project) => project.id === "foil")).toBe(false);
		expect(workspace.metadata.sourceMode).toBe("legacy-adapter");
		expect(workspace.workspacePresets.find((preset) => preset.id === "foil-command")?.defaultProjectId).toBeUndefined();
	});

	it("keeps `partial_green` open instead of reading it as done", async () => {
		useLiveGraph();
		const workspace = await loadControlWorkspace();

		expect(workspace.workItems[0].status).not.toBe("done");
		expect(workspace.workItems[0].rawStatus).toBe("partial_green");
	});

	it("does not let an empty `projects` collection hide a populated legacy graph", async () => {
		useLiveGraph({ projects: [] });
		const workspace = await loadControlWorkspace();

		expect(workspace.metadata.sourceMode).toBe("legacy-adapter");
		expect(workspace.metadata.warning).toMatch(/Empty `projects` collection ignored/);
		expect(workspace.projects).toHaveLength(2);
	});

	it("uses seed-empty only for a genuinely empty database", async () => {
		const workspace = await loadControlWorkspace();
		expect(workspace.metadata.sourceMode).toBe("seed-empty");
	});

	it("uses seed-disabled when control persistence is intentionally off", async () => {
		state.env.DATAPASS_CONTROL_DISABLED = "true";
		const workspace = await loadControlWorkspace();
		expect(workspace.metadata.sourceMode).toBe("seed-disabled");
	});

	it("surfaces connection failures as fallback-error without leaking the URI", async () => {
		useLiveGraph();
		state.connectError = new Error("connect failed for mongodb+srv://user:secret@cluster.example.net/db");
		const workspace = await loadControlWorkspace();

		expect(workspace.metadata.sourceMode).toBe("fallback-error");
		expect(workspace.metadata.warning).toContain("[redacted-mongodb-uri]");
		expect(workspace.metadata.warning).not.toContain("secret");
	});
});

describe("control write chokepoint", () => {
	beforeEach(() => {
		state.env.DATAPASS_CONTROL_WRITE_ENABLED = "true";
	});

	it("flags any legacy graph collection as write-blocking", () => {
		expect(workspaceWriteBlockReason(["projects", "work_items"])).toBeNull();
		expect(workspaceWriteBlockReason(["projects", "work_items", "entities"])).toMatch(/entities/);
	});

	it("refuses a workspace replace on a mixed database so global work_items are never erased", async () => {
		useLiveGraph({ projects: [{ id: "p1" }] });
		const workspace = await loadControlWorkspace();

		await expect(saveControlWorkspace(workspace, "replace")).rejects.toThrow(/legacy DATAPASSCONTROL graph/);
		expect(state.writes).toEqual([]);
	});

	it("refuses ChangeSet staging against the live graph even when the env flag allows writes", async () => {
		useLiveGraph();

		await expect(stageControlChangeSet({})).rejects.toThrow(/legacy DATAPASSCONTROL graph/);
		expect(state.writes).toEqual([]);
	});

	it("does not bootstrap control_meta inside the live graph on a read", async () => {
		useLiveGraph();

		await getWorkspaceIdentity();
		expect(state.writes).toEqual([]);
	});
});
