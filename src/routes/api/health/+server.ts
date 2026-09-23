import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
	return json(
		{
			status: "ok",
			service: "datapass-mongo-control",
			mode: "preview-read-only",
			timestamp: new Date().toISOString(),
		},
		{
			headers: {
				"cache-control": "no-store",
			},
		},
	);
};
