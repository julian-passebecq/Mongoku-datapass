import { executeReports } from "$lib/server/reportEngine";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
	const reports = await executeReports([
		"FOIL_ARCHITECTURE_MAP",
		"FOIL_PROJECTS",
		"FOIL_PROPAGATION_PENDING"
	]);
	return { reports };
};
