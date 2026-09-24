import { Decimal128, Long, ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { toSerializableRow } from "$lib/datapass/serializable";

describe("report row serialization", () => {
	it("turns BSON values from live collections into plain JSON for SvelteKit load", () => {
		const id = new ObjectId("6ab286ec3a1578b7ee5cdcf2");
		const row = toSerializableRow({
			_id: id,
			observed_at: new Date("2026-09-24T20:28:00Z"),
			ci_evidence: { push_run: Long.fromString("36049961696"), big: Long.fromString("9223372036854775807") },
			score: Decimal128.fromString("1.5"),
			nested: [{ ref: id }],
		});

		expect(row).toEqual({
			_id: "6ab286ec3a1578b7ee5cdcf2",
			observed_at: "2026-09-24T20:28:00.000Z",
			ci_evidence: { push_run: 36049961696, big: "9223372036854775807" },
			score: { $numberDecimal: "1.5" },
			nested: [{ ref: "6ab286ec3a1578b7ee5cdcf2" }],
		});
		expect(Object.getPrototypeOf(row)).toBe(Object.prototype);
	});
});
