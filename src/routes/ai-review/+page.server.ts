import { getWorkspaceIdentity, listControlChangeSets } from "$lib/server/datapassHistory";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent }) => {
	const parentData = await parent();
	const [identity, changeSets] = await Promise.all([getWorkspaceIdentity(), listControlChangeSets(100)]);

	return {
		identity,
		changeSets,
		controlWritesEnabled: parentData.controlWritesEnabled,
	};
};
