import { json } from "@sveltejs/kit";
import { z } from "zod";
import { acceptControlChangeSet, rejectControlChangeSet } from "$lib/server/datapassHistory";
import type { RequestHandler } from "./$types";

const requestSchema = z.object({
	action: z.enum(["accept", "reject"]),
	selectedOperationIds: z.array(z.string()).optional(),
});

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const body = requestSchema.parse(await request.json());

		if (body.action === "reject") {
			const result = await rejectControlChangeSet(params.id);
			return json({ ok: true, result });
		}

		const result = await acceptControlChangeSet(params.id, body.selectedOperationIds);
		return json({ ok: true, result });
	} catch (error) {
		return json(
			{
				ok: false,
				error: error instanceof Error ? error.message : "ChangeSet decision failed",
			},
			{ status: 400 },
		);
	}
};
