import { describe, expect, it } from "vitest";
import { hostKeyOf, reconcileEnvHosts, type PersistedHost } from "$lib/server/hostReconciliation";

const adminDp = "mongodb+srv://admin:old-secret@clusterdp.example.net/?retryWrites=true";
const readonlyDp = "mongodb+srv://reader:new-secret@clusterdp.example.net/?retryWrites=true";
const readonlyPm = "mongodb+srv://reader:pm-secret@pm.example.net/";
const readonlyCore = "mongodb+srv://reader:core-secret@core.example.net/";

function ids() {
	let next = 0;
	return () => "new-id-" + ++next;
}

describe("MONGOKU_DEFAULT_HOST reconciliation", () => {
	it("replaces a stale credential for the same server and adds new env servers", () => {
		// The file was seeded long ago from an admin URI; .env now lists read-only users.
		const persisted: PersistedHost[] = [{ path: adminDp, _id: "dp-id" }];
		const result = reconcileEnvHosts(persisted, [readonlyDp, readonlyPm, readonlyCore], ids());

		expect(result.hosts).toEqual([
			{ path: readonlyDp, _id: "dp-id", source: "env" },
			{ path: readonlyPm, _id: "new-id-1", source: "env" },
			{ path: readonlyCore, _id: "new-id-2", source: "env" },
		]);
		expect(result.hosts.some((host) => host.path.includes("admin"))).toBe(false);
		expect(result.replaced).toEqual(["clusterdp.example.net"]);
		expect(result.added).toEqual(["pm.example.net", "core.example.net"]);
	});

	it("keeps servers added from the UI and drops env servers no longer listed", () => {
		const uiAdded = "mongodb://localhost:27018";
		const persisted: PersistedHost[] = [
			{ path: readonlyDp, _id: "dp-id", source: "env" },
			{ path: readonlyPm, _id: "pm-id", source: "env" },
			{ path: uiAdded, _id: "ui-id" },
		];
		const result = reconcileEnvHosts(persisted, [readonlyDp], ids());

		expect(result.hosts).toEqual([
			{ path: readonlyDp, _id: "dp-id", source: "env" },
			{ path: uiAdded, _id: "ui-id" },
		]);
		expect(result.removed).toEqual(["pm.example.net"]);
	});

	it("is a no-op when the file already matches the env", () => {
		const persisted: PersistedHost[] = [
			{ path: readonlyDp, _id: "dp-id", source: "env" },
			{ path: readonlyPm, _id: "pm-id", source: "env" },
		];
		const result = reconcileEnvHosts(persisted, [readonlyDp, readonlyPm, " ", ""], ids());

		expect(result.hosts).toEqual(persisted);
		expect([...result.replaced, ...result.removed, ...result.added]).toEqual([]);
	});

	it("keys servers by host list, without credentials or options", () => {
		expect(hostKeyOf(adminDp)).toBe("clusterdp.example.net");
		expect(hostKeyOf(readonlyDp)).toBe(hostKeyOf(adminDp));
		expect(hostKeyOf("localhost:27017")).toBe("localhost:27017");
	});
});
