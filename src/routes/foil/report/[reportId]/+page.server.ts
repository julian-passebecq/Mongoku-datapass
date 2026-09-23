import { error } from "@sveltejs/kit";
import { executeReport } from "$lib/server/reportEngine";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
	if (!params.reportId.startsWith("FOIL_")) {
		throw error(404, "FOIL report not found");
	}
	try {
		return { report: await executeReport(params.reportId) };
	} catch (caught) {
		throw error(404, caught instanceof Error ? caught.message : "FOIL report not found");
	}
};
