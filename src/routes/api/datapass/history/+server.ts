import { json } from "@sveltejs/kit";
import { compareControlRevisions, listControlActivity, listControlRevisions } from "$lib/server/datapassHistory";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
	const left = Number(url.searchParams.get("left"));
	const right = Number(url.searchParams.get("right"));
	const [revisions, activity] = await Promise.all([listControlRevisions(100), listControlActivity(100)]);

	let comparison = null;
	if (Number.isInteger(left) && Number.isInteger(right)) {
		comparison = await compareControlRevisions(left, right);
	}

	return json(
		{ revisions, activity, comparison },
		{
			headers: { "cache-control": "no-store" },
		},
	);
};
