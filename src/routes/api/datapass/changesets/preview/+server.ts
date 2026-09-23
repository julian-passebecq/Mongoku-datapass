import { json } from "@sveltejs/kit";
import { z } from "zod";
import { previewControlChangeSet } from "$lib/server/datapassHistory";
import type { RequestHandler } from "./$types";

const requestSchema = z.object({
	changeSet: z.unknown(),
	selectedOperationIds: z.array(z.string()).optional()
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		const parsed = requestSchema.parse(await request.json());
		const result = await previewControlChangeSet(
			parsed.changeSet,
			parsed.selectedOperationIds
		);
		return json(result, {
			status: result.ok ? 200 : 409,
			headers: { "cache-control": "no-store" }
		});
	} catch (error) {
		return json({
			ok: false,
			error: error instanceof Error ? error.message : "ChangeSet preview failed"
		}, { status: 400 });
	}
};
