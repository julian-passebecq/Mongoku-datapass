/**
 * Converts a Mongo document into plain JSON values so SvelteKit can serialize it from `load`.
 * BSON types use their own `toJSON` (ObjectId -> hex string, Date -> ISO string, Binary -> base64,
 * Decimal128 -> `{ $numberDecimal }`); Long values become numbers when safe, strings otherwise.
 */
export function toSerializableRow(row: Record<string, unknown>): Record<string, unknown> {
	return JSON.parse(
		JSON.stringify(row, function (key, value: unknown) {
			if (typeof value === "bigint") {
				return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
			}
			const raw = (this as Record<string, unknown>)[key];
			if (raw && typeof raw === "object" && (raw as { _bsontype?: string })._bsontype === "Long") {
				const long = raw as { toNumber(): number; toString(): string };
				const asNumber = long.toNumber();
				return Number.isSafeInteger(asNumber) ? asNumber : long.toString();
			}
			return value;
		}),
	) as Record<string, unknown>;
}
