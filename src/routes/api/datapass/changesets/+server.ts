import { json } from "@sveltejs/kit";
import { z } from "zod";
import {
	listControlChangeSets,
	stageControlChangeSet
} from "$lib/server/datapassHistory";
import type { RequestHandler } from "./$types";

const requestSchema = z.object({ changeSet: z.unknown() });

export const GET: RequestHandler = async ({ url }) => {
	const limit = Number(url.searchParams.get("limit") ?? 100);
	const rows = await listControlChangeSets(Number.isFinite(limit) ? limit : 100);
	return json({ rows }, { headers: { "cache-control": "no-store" } });
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const parsed = requestSchema.parse(await request.json());
		const row = await stageControlChangeSet(parsed.changeSet);
		return json({ ok: true, row }, { status: 201 });
	} catch (error) {
		return json({
			ok: false,
			error: error instanceof Error ? error.message : "ChangeSet staging failed"
		}, { status: 400 });
	}
};
