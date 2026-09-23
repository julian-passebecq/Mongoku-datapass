import { executeReports } from "$lib/server/reportEngine";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent }) => {
	const parentData = await parent();
	const reports = await executeReports(["FOIL_ARCHITECTURE_MAP", "FOIL_PROJECTS", "FOIL_PROPAGATION_PENDING"]);
	return {
		reports,
		sources: parentData.controlWorkspace.sources.filter((source) => source.id.startsWith("FOIL_")),
	};
};
