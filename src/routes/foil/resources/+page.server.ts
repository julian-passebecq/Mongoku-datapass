import { executeReport } from "$lib/server/reportEngine";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent }) => {
	const parentData = await parent();
	return {
		report: await executeReport("FOIL_RESOURCE_INVENTORY"),
		sources: parentData.controlWorkspace.sources,
	};
};
