import { env } from "$env/dynamic/private";
import { json } from "@sveltejs/kit";
import { controlWritesEnabled } from "$lib/server/datapassControl";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
	const controlDisabled = env.DATAPASS_CONTROL_DISABLED === "true";
	const readOnly = env.MONGOKU_READ_ONLY_MODE === "true";
	const writesEnabled = controlWritesEnabled();
	const mode = controlDisabled
		? "seed-preview"
		: writesEnabled
			? "mongo-read-write"
			: readOnly
				? "mongo-read-only"
				: "mongo-control-read-only";

	return json(
		{
			status: "ok",
			service: "datapass-mongo-control",
			mode,
			controlDisabled,
			readOnly,
			writesEnabled,
			commit: env.VERCEL_GIT_COMMIT_SHA || null,
			timestamp: new Date().toISOString(),
		},
		{
			headers: {
				"cache-control": "no-store",
			},
		},
	);
};
