import type { Db } from "mongodb";
import { describe, expect, it } from "vitest";
import { inventoryRows } from "$lib/server/sourceInventory";

function fakeDb(collections: Array<{ name: string; type?: string }>, counts: Record<string, number>) {
	const calls: string[] = [];
	const db = {
		listCollections: (filter: unknown, options: unknown) => {
			calls.push("listCollections " + JSON.stringify([filter, options]));
			return { toArray: async () => collections };
		},
		collection: (name: string) => ({
			estimatedDocumentCount: async () => {
				calls.push("count " + name);
				return counts[name] ?? 0;
			},
			// Any document read would show up here and fail the test.
			find: () => {
				throw new Error("inventory must not read documents");
			},
		}),
	};
	return { db: db as unknown as Db, calls };
}

describe("source inventory", () => {
	it("lists collections with estimated counts, sorted, without system collections", async () => {
		const { db, calls } = fakeDb(
			[{ name: "work_items" }, { name: "system.views" }, { name: "entities" }, { name: "open_view", type: "view" }],
			{ entities: 31, work_items: 32 },
		);

		const rows = await inventoryRows(db, 100, 5000);

		expect(rows.map((row) => [row.name, row.type, row.estimatedDocuments])).toEqual([
			["entities", "collection", 31],
			["open_view", "view", null],
			["work_items", "collection", 32],
		]);
		expect(rows[0].summary).toBe("31 documents (estimated)");
		expect(rows.every((row) => row.status === "READABLE")).toBe(true);
		// Only metadata commands: authorized names, then counts for real collections.
		expect(calls).toEqual([
			'listCollections [{},{"nameOnly":true,"authorizedCollections":true}]',
			"count entities",
			"count work_items",
		]);
	});

	it("returns one extra row past the limit so truncation can be reported", async () => {
		const { db } = fakeDb([{ name: "a" }, { name: "b" }, { name: "c" }], {});
		expect(await inventoryRows(db, 2, 5000)).toHaveLength(3);
	});
});
