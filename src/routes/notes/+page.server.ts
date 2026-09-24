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
	const queryId = projectId ? "project-notes" : "notes-recent";
	const noteTypes = new Set(["note", "decision", "research"]);

	let items = workspace.workItems.filter((item) => noteTypes.has(item.type));
	if (projectId) {
		items = items.filter((item) => projectIds.includes(item.projectId));
	}
	items = items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

	if (workspace.metadata.source === "mongo" && workspace.savedQueries.some((query) => query.id === queryId)) {
		try {
			const rows = await executeSavedQuery(queryId, projectId ? { projectIds } : {});
			items = rows as typeof workspace.workItems;
		} catch {
			// Canonical workspace fallback.
		}
	}

	return { workspace, projectId, queryId, items };
};
