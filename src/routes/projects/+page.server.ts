import {
	executeSavedControlQuery,
	loadControlWorkspace
} from "$lib/server/datapassControl";
import type { PageServerLoad } from "./$types";

type StatusSummary = Record<string, number>;

function projectScope(projectId: string, projects: Array<{ id: string; parentProjectId?: string }>): string[] {
	const ids = [projectId];
	const children = projects.filter((project) => project.parentProjectId === projectId);

	for (const child of children) {
		ids.push(...projectScope(child.id, projects));
	}

	return ids;
}

function localSummary(projectIds: string[], workItems: Array<{ projectId: string; status: string }>): StatusSummary {
	const summary: StatusSummary = {};

	for (const item of workItems) {
		if (!projectIds.includes(item.projectId)) continue;
		summary[item.status] = (summary[item.status] ?? 0) + 1;
	}

	return summary;
}

export const load: PageServerLoad = async () => {
	const workspace = await loadControlWorkspace();
	let portfolioProjects = workspace.projects;

	if (workspace.metadata.source === "mongo") {
		try {
			const rows = await executeSavedControlQuery("project-portfolio-board");
			portfolioProjects = rows as typeof workspace.projects;
		} catch {
			portfolioProjects = workspace.projects;
		}
	}

	const entries = await Promise.all(
		workspace.projects.map(async (project) => {
			const ids = projectScope(project.id, workspace.projects);

			if (workspace.metadata.source === "mongo" && project.statusQueryId) {
				try {
					const rows = await executeSavedControlQuery(project.statusQueryId, { projectIds: ids });
					const summary = Object.fromEntries(
						rows.map((row) => [String(row._id), Number(row.count ?? 0)])
					);
					return [project.id, summary] as const;
				} catch {
					// Fall through to local summary.
				}
			}

			return [project.id, localSummary(ids, workspace.workItems)] as const;
		})
	);

	return {
		workspace,
		portfolioProjects,
		projectSummaries: Object.fromEntries(entries)
	};
};
