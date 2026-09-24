import { executeSavedQuery } from "$lib/server/savedQueryEngine";
import type { PageServerLoad } from "./$types";

function projectScope(projectId: string, projects: Array<{ id: string; parentProjectId?: string }>): string[] {
	const children = projects.filter((project) => project.parentProjectId === projectId);
	return [projectId, ...children.flatMap((child) => projectScope(child.id, projects))];
}

export const load: PageServerLoad = async ({ parent, url }) => {
	const { controlWorkspace: workspace } = await parent();
	const projectId = url.searchParams.get("project");
	const projectIds = projectId ? projectScope(projectId, workspace.projects) : [];
	const queryId = projectId ? "project-calendar" : "calendar-upcoming";

	let items = workspace.workItems.filter((item) => item.status !== "done" && !!item.dueDate);
	if (projectId) {
		items = items.filter((item) => projectIds.includes(item.projectId));
	}
	items = items.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));

	if (workspace.metadata.source === "mongo" && workspace.savedQueries.some((query) => query.id === queryId)) {
		try {
			const rows = await executeSavedQuery(queryId, projectId ? { projectIds } : {});
			items = rows as typeof workspace.workItems;
		} catch {
			// Local canonical workspace remains the fallback.
		}
	}

	return {
		workspace,
		projectId,
		queryId,
		items,
	};
};
