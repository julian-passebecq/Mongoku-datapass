import {
	compareControlRevisions,
	getWorkspaceIdentity,
	listControlActivity,
	listControlRevisions
} from "$lib/server/datapassHistory";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent, url }) => {
	const parentData = await parent();
	const [identity, revisions, activity] = await Promise.all([
		getWorkspaceIdentity(),
		listControlRevisions(100),
		listControlActivity(100)
	]);

	const requestedLeft = Number(url.searchParams.get("left"));
	const requestedRight = Number(url.searchParams.get("right"));
	const left = Number.isInteger(requestedLeft)
		? requestedLeft
		: Number(revisions[1]?.revision ?? revisions[0]?.revision);
	const right = Number.isInteger(requestedRight)
		? requestedRight
		: Number(revisions[0]?.revision);

	let comparison = null;
	if (Number.isInteger(left) && Number.isInteger(right)) {
		try {
			comparison = await compareControlRevisions(left, right);
		} catch {
			comparison = null;
		}
	}

	return {
		identity,
		revisions,
		activity,
		left,
		right,
		comparison,
		controlWritesEnabled: parentData.controlWritesEnabled
	};
};
