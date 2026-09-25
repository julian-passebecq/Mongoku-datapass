import type { Db } from "mongodb";

/**
 * Collection names and estimated counts for one resolved source. Metadata only: the `read` role
 * grants listCollections and count, and no document is fetched. Views and time series are
 * listed without a count. Returns at most `limit + 1` rows so the caller can flag truncation.
 */
export async function inventoryRows(db: Db, limit: number, maxTimeMS: number): Promise<Record<string, unknown>[]> {
	const collections = (await db.listCollections({}, { nameOnly: true, authorizedCollections: true }).toArray())
		.filter((info) => !info.name.startsWith("system."))
		.sort((a, b) => a.name.localeCompare(b.name))
		.slice(0, limit + 1);

	const rows: Record<string, unknown>[] = [];
	for (const info of collections) {
		const type = info.type ?? "collection";
		const estimatedDocuments =
			type === "collection" ? await db.collection(info.name).estimatedDocumentCount({ maxTimeMS }) : null;
		rows.push({
			_id: info.name,
			name: info.name,
			collection: info.name,
			type,
			status: "READABLE",
			estimatedDocuments,
			summary: estimatedDocuments === null ? type : estimatedDocuments + " documents (estimated)",
		});
	}
	return rows;
}
