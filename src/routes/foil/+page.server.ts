import { executeReports } from "$lib/server/reportEngine";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
	const reports = await executeReports([
		"FOIL_STATUS_NOW",
		"FOIL_NEXT",
		"FOIL_RECENT",
		"FOIL_PROPAGATION_PENDING",
		"FOIL_MAINTENANCE_DUE",
		"FOIL_INSTRUCTION_DRIFT",
		"FOIL_GLOBAL_REFERENCES"
	]);

	return { reports };
};
