import { executeReports } from "$lib/server/reportEngine";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
	const reports = await executeReports(["GLOBAL_PROJECTS", "FOIL_STATUS_NOW"]);
	return { reports };
};
