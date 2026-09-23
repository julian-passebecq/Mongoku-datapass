import type { WorkspaceExport } from "$lib/datapass/workspaceSchema";
import { executeSavedQuery } from "$lib/server/savedQueryEngine";
import type { PageServerLoad } from "./$types";

function projectScope(projectId: string, projects: Array<{ id: string; parentProjectId?: string }>): string[] {
	const children = projects.filter((project) => project.parentProjectId === projectId);
	return [projectId, ...children.flatMap((child) => projectScope(child.id, projects))];
}

function seedRows(
	queryId: string,
	projectId: string | null,
	workspace: WorkspaceExport
): unknown[] {
	const projectIds = projectId ? projectScope(projectId, workspace.projects) : [];

	switch (queryId) {
		case "project-portfolio-board":
			return workspace.projects.filter((project) => project.status !== "done");
		case "project-open-work":
			return workspace.workItems.filter((item) => projectIds.includes(item.projectId) && item.status !== "done");
		case "project-calendar":
			return workspace.workItems.filter((item) => projectIds.includes(item.projectId) && item.status !== "done" && item.dueDate);
		case "calendar-upcoming":
			return workspace.workItems.filter((item) => item.status !== "done" && item.dueDate);
		case "project-notes":
			return workspace.workItems.filter((item) => projectIds.includes(item.projectId) && ["note", "decision", "research"].includes(item.type));
		case "notes-recent":
			return workspace.workItems.filter((item) => ["note", "decision", "research"].includes(item.type));
		case "project-detail":
			return workspace.projects.filter((project) => project.id === projectId);
		case "project-work-status-summary": {
			const counts = new Map<string, number>();
			for (const item of workspace.workItems.filter((candidate) => projectIds.includes(candidate.projectId))) {
				counts.set(item.status, (counts.get(item.status) || 0) + 1);
			}
			return Array.from(counts.entries()).map(([status, count]) => ({ _id: status, count }));
		}
		default:
			return [];
	}
}

export const load: PageServerLoad = async ({ parent, url }) => {
	const { controlWorkspace: workspace } = await parent();
	const queryId = url.searchParams.get("query") || workspace.savedQueries[0]?.id || "";
	const projectId = url.searchParams.get("project");
	const query = workspace.savedQueries.find((candidate) => candidate.id === queryId);
	const projectIds = projectId ? projectScope(projectId, workspace.projects) : [];

	let rows: unknown[] = [];
	let error: string | null = null;

	if (query) {
		if (workspace.metadata.source === "mongo") {
			try {
				const parameters: Record<string, unknown> = {};
				for (const parameter of query.parameters) {
					if (parameter.source === "project") {
						parameters[parameter.name] = projectId;
					}
					if (parameter.source === "project-tree") {
						parameters[parameter.name] = projectIds;
					}
				}
				if (!query.parameters.some((parameter) => parameter.source === "manual")) {
					rows = await executeSavedQuery(query.id, parameters);
				}
			} catch (caught) {
				error = caught instanceof Error ? caught.message : "Query failed";
			}
		} else {
			rows = seedRows(query.id, projectId, workspace);
		}
	}

	return { workspace, queryId, projectId, query, rows, error };
};
