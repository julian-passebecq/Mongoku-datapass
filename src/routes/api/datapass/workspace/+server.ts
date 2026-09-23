import { json } from "@sveltejs/kit";
import { z } from "zod";
import { workspaceExportSchema } from "$lib/datapass/workspaceSchema";
import {
	controlWritesEnabled,
	loadControlWorkspace,
	saveControlWorkspace
} from "$lib/server/datapassControl";
import type { RequestHandler } from "./$types";

const writeRequestSchema = z.object({
	mode: z.enum(["merge", "replace"]).default("merge"),
	confirmReplace: z.string().optional(),
	workspace: workspaceExportSchema
});

export const GET: RequestHandler = async () => {
	const workspace = await loadControlWorkspace();
	return json(workspace, {
		headers: {
			"cache-control": "no-store"
		}
	});
};

export const PUT: RequestHandler = async ({ request }) => {
	if (!controlWritesEnabled()) {
		return json(
			{
				ok: false,
				error: "Datapass control writes are disabled. Set DATAPASS_CONTROL_WRITE_ENABLED=true on your local/private instance."
			},
			{ status: 403 }
		);
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
	}

	const parsed = writeRequestSchema.safeParse(payload);
	if (!parsed.success) {
		return json(
			{
				ok: false,
				error: "Workspace JSON failed schema validation",
				issues: parsed.error.issues
			},
			{ status: 400 }
		);
	}

	if (parsed.data.mode === "replace" && parsed.data.confirmReplace !== "replace-workspace") {
		return json(
			{
				ok: false,
				error: 'Full replacement requires confirmReplace="replace-workspace". Use merge for normal AI edits.'
			},
			{ status: 400 }
		);
	}

	await saveControlWorkspace(parsed.data.workspace, parsed.data.mode);
	return json({ ok: true, mode: parsed.data.mode });
};
