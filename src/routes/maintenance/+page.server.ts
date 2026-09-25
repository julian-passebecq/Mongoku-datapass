import { error } from "@sveltejs/kit";
import { executeReport } from "$lib/server/reportEngine";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
	try {
		return { report: await executeReport("MAINTENANCE") };
	} catch (caught) {
		throw error(500, caught instanceof Error ? caught.message : "Maintenance report failed");
	}
};
