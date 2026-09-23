import { loadControlWorkspace, executeSavedControlQuery } from "$lib/server/datapassControl";
import { executeSourceQuery } from "$lib/server/reportEngine";

export async function executeSavedQuery(
	queryId: string,
	parameters: Record<string, unknown> = {},
): Promise<Record<string, unknown>[]> {
	const workspace = await loadControlWorkspace();
	const query = workspace.savedQueries.find((candidate) => candidate.id === queryId);

	if (!query) {
		throw new Error("Saved query not found: " + queryId);
	}

	if (!query.readOnly) {
		throw new Error("Only read-only saved queries can be executed");
	}

	if (!query.sourceId) {
		return executeSavedControlQuery(queryId, parameters);
	}

	const section = await executeSourceQuery(
		{
			id: query.id,
			sourceId: query.sourceId,
			authority: query.authority ?? "Unspecified authority",
			collection: query.collection,
			operation: query.operation,
			filter: query.filter,
			projection: query.projection,
			pipeline: query.pipeline,
			sort: query.sort,
			limit: query.limit,
			parameters: query.parameters.map((parameter) => ({
				name: parameter.name,
				type: parameter.type,
				required: true,
			})),
			label: query.name,
		},
		parameters,
		query.routeId ?? query.id,
	);

	if (!section.trace.resolved) {
		throw new Error(section.trace.message ?? "Saved query source is unavailable");
	}

	return section.rows;
}
