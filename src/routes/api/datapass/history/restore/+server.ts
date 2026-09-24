import { json } from "@sveltejs/kit";
import { z } from "zod";
import { restoreControlRevision } from "$lib/server/datapassHistory";
import type { RequestHandler } from "./$types";

const requestSchema = z.object({
	revision: z.number().int().nonnegative(),
	expectedRevision: z.number().int().nonnegative(),
	expectedFingerprint: z.string().min(1),
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = requestSchema.parse(await request.json());
		const result = await restoreControlRevision(body.revision, {
			revision: body.expectedRevision,
			fingerprint: body.expectedFingerprint,
			updatedAt: "",
		});
		return json({ ok: true, result });
	} catch (error) {
		return json(
			{
				ok: false,
				error: error instanceof Error ? error.message : "Restore failed",
			},
			{ status: 400 },
		);
	}
};
