import { executeReport } from "$lib/server/reportEngine";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => ({
	report: await executeReport("FOIL_RESOURCE_INVENTORY")
});
