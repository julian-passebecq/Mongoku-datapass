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

	const leftParam = url.searchParams.get("left");
	const rightParam = url.searchParams.get("right");
	const requestedLeft = leftParam === null ? null : Number(leftParam);
	const requestedRight = rightParam === null ? null : Number(rightParam);
	const fallbackLeft = revisions[1]?.revision ?? revisions[0]?.revision;
	const fallbackRight = revisions[0]?.revision;
	const left =
		requestedLeft !== null && Number.isInteger(requestedLeft)
			? requestedLeft
			: typeof fallbackLeft === "number"
				? fallbackLeft
				: null;
	const right =
		requestedRight !== null && Number.isInteger(requestedRight)
			? requestedRight
			: typeof fallbackRight === "number"
				? fallbackRight
				: null;

	let comparison = null;
	if (typeof left === "number" && typeof right === "number") {
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
