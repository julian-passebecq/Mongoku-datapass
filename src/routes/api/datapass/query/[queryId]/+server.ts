import { json } from "@sveltejs/kit";
import { z } from "zod";
import { executeSavedControlQuery } from "$lib/server/datapassControl";
import type { RequestHandler } from "./$types";

const requestSchema = z.object({
	parameters: z.record(z.string(), z.unknown()).default({})
});

export const POST: RequestHandler = async ({ params, request }) => {
	let payload: unknown = {};
	try {
		payload = await request.json();
	} catch {
		payload = {};
	}

	const parsed = requestSchema.safeParse(payload);
	if (!parsed.success) {
		return json({ ok: false, error: "Invalid query parameters", issues: parsed.error.issues }, { status: 400 });
	}

	try {
		const rows = await executeSavedControlQuery(params.queryId, parsed.data.parameters);
		return json({ ok: true, queryId: params.queryId, rows }, { headers: { "cache-control": "no-store" } });
	} catch (error) {
		return json(
			{
				ok: false,
				error: error instanceof Error ? error.message : "Saved control query failed"
			},
			{ status: 400 }
		);
	}
};
