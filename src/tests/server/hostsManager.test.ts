import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock("$env/dynamic/private", () => ({ env: state.env }));

const adminDp = "mongodb+srv://admin:old-secret@clusterdp.example.net/";
const readonlyDp = "mongodb+srv://reader:new-secret@clusterdp.example.net/";
const readonlyPm = "mongodb+srv://reader:pm-secret@pm.example.net/";

let dir: string;
let file: string;

async function loadManager() {
	vi.resetModules();
	const { HostsManager } = await import("$lib/server/HostsManager");
	const manager = new HostsManager();
	await manager.load();
	return manager;
}

function persistedLines() {
	return fs
		.readFileSync(file, "utf8")
		.trim()
		.split("\n")
		.map((line) => JSON.parse(line));
}

describe("HostsManager with an explicit MONGOKU_DEFAULT_HOST", () => {
	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "mongoku-hosts-"));
		file = path.join(dir, ".mongoku.db");
		for (const key of Object.keys(state.env)) {
			delete state.env[key];
		}
		state.env.MONGOKU_DATABASE_FILE = file;
	});

	afterEach(() => {
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it("stops loading a stale persisted credential once .env changes", async () => {
		fs.writeFileSync(file, JSON.stringify({ path: adminDp, _id: "dp-id" }) + "\n");
		state.env.MONGOKU_DEFAULT_HOST = [readonlyDp, readonlyPm].join(";");

		const hosts = await (await loadManager()).getHosts();

		expect(hosts.map((host) => host.path)).toEqual([readonlyDp, readonlyPm]);
		expect(hosts[0]._id).toBe("dp-id");
		expect(fs.readFileSync(file, "utf8")).not.toContain("old-secret");
		expect(persistedLines().every((line) => line.source === "env")).toBe(true);
	});

	it("keeps the legacy behaviour without MONGOKU_DEFAULT_HOST: the persisted list wins", async () => {
		fs.writeFileSync(file, JSON.stringify({ path: adminDp, _id: "dp-id" }) + "\n");

		const hosts = await (await loadManager()).getHosts();

		expect(hosts).toEqual([{ path: adminDp, _id: "dp-id" }]);
	});

	it("seeds a missing file from the env", async () => {
		state.env.MONGOKU_DEFAULT_HOST = readonlyPm;

		const hosts = await (await loadManager()).getHosts();

		expect(hosts.map((host) => host.path)).toEqual([readonlyPm]);
		expect(persistedLines()).toEqual([{ path: readonlyPm, _id: hosts[0]._id, source: "env" }]);
	});
});
