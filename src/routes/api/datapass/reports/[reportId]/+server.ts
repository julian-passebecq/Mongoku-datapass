import { json } from "@sveltejs/kit";
import { executeReport } from "$lib/server/reportEngine";
import type { RequestHandler } from "./$types";

function queryParameters(url: URL): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const key of new Set(url.searchParams.keys())) {
		const values = url.searchParams.getAll(key);
		result[key] = values.length > 1 ? values : values[0];
	}
	return result;
}

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const report = await executeReport(params.reportId, queryParameters(url));
		return json(report, {
			headers: {
				"cache-control": "no-store",
			},
		});
	} catch (error) {
		return json(
			{
				ok: false,
				reportId: params.reportId,
				error: error instanceof Error ? error.message : "Report execution failed",
			},
			{ status: 400 },
		);
	}
};
