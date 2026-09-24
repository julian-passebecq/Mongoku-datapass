import type { Project, ProjectStatus, WorkItem, WorkStatus, WorkType } from "./controlPlane";

export type ControlPersistenceMode = "workspace-v1" | "legacy-global" | "empty-or-unknown";

function text(row: Record<string, unknown>, key: string): string {
	const value = row[key];
	return value == null ? "" : String(value).trim();
}

function optionalText(row: Record<string, unknown>, key: string): string | undefined {
	const value = text(row, key);
	return value || undefined;
}

function numeric(row: Record<string, unknown>, key: string): number | undefined {
	const value = row[key];
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function detectControlPersistenceMode(collectionNames: Iterable<string>): ControlPersistenceMode {
	const names = new Set(collectionNames);
	if (names.has("projects")) {
		return "workspace-v1";
	}
	if (names.has("entities") && names.has("work_items")) {
		return "legacy-global";
	}
	return "empty-or-unknown";
}

function normalizeProjectStatus(rawStatus: string): ProjectStatus {
	const raw = rawStatus.toLowerCase();
	if (/stopped|done|closed|archived|retired/.test(raw)) {
		return "done";
	}
	if (/planned|candidate|reference|donor|paused|hold/.test(raw)) {
		return "paused";
	}
	return "active";
}

function normalizeProjectKanban(rawStatus: string): WorkStatus {
	const raw = rawStatus.toLowerCase();
	if (/stopped|done|closed|archived|retired/.test(raw)) {
		return "done";
	}
	if (/block|wait|hold/.test(raw)) {
		return "blocked";
	}
	if (/planned|candidate|reference|donor|draft/.test(raw)) {
		return "backlog";
	}
	if (/ready|verify|review|test/.test(raw)) {
		return "todo";
	}
	return "in_progress";
}

function normalizeWorkStatus(rawStatus: string): WorkStatus {
	const raw = rawStatus.toLowerCase();
	if (/done|green|complete|completed|resolved|mitigated|closed/.test(raw)) {
		return "done";
	}
	if (/block|wait|hold/.test(raw)) {
		return "blocked";
	}
	if (/ongoing|active|in_progress|progress/.test(raw)) {
		return "in_progress";
	}
	if (/planned|backlog|draft/.test(raw)) {
		return "backlog";
	}
	return "todo";
}

function normalizeWorkType(rawKind: string): WorkType {
	const raw = rawKind.toLowerCase();
	if (/conflict|incoherence|blocker|bug/.test(raw)) {
		return "bug";
	}
	if (/decision/.test(raw)) {
		return "decision";
	}
	if (/research/.test(raw)) {
		return "research";
	}
	if (/idea/.test(raw)) {
		return "idea";
	}
	if (/release|milestone/.test(raw)) {
		return "milestone";
	}
	if (/documentation|note/.test(raw)) {
		return "note";
	}
	return "task";
}

function normalizePriority(rawPriority: string): WorkItem["priority"] {
	const raw = rawPriority.toUpperCase();
	if (raw.startsWith("P0")) {
		return "high";
	}
	if (raw.startsWith("P1")) {
		return "medium";
	}
	return "low";
}

function tags(...values: Array<string | undefined>): string[] {
	return Array.from(new Set(values.filter((value): value is string => !!value)));
}

export function legacyWorkItemToWorkspaceItem(row: Record<string, unknown>): WorkItem | null {
	const id = text(row, "work_item_id") || text(row, "id");
	const projectId = text(row, "project_id");
	const title = text(row, "title");
	if (!id || !projectId || !title) {
		return null;
	}

	const rawStatus = text(row, "status");
	const rawKind = text(row, "kind");
	const rawPriority = text(row, "priority");
	const severity = text(row, "severity");

	return {
		id,
		projectId,
		title,
		status: normalizeWorkStatus(rawStatus),
		type: normalizeWorkType(rawKind),
		priority: normalizePriority(rawPriority),
		dueDate:
			optionalText(row, "due_at") ??
			optionalText(row, "dueDate") ??
			optionalText(row, "next_review_at") ??
			optionalText(row, "nextReviewAt"),
		createdAt: optionalText(row, "observed_at") ?? optionalText(row, "created_at"),
		tags: tags(
			"legacy-adapter",
			rawKind ? "raw-kind:" + rawKind : undefined,
			rawStatus ? "raw-status:" + rawStatus : undefined,
			rawPriority ? "raw-priority:" + rawPriority : undefined,
			severity ? "severity:" + severity : undefined,
		),
		classification: "GLOBAL_PORTFOLIO_WORK",
		rawStatus: rawStatus || undefined,
		rawKind: rawKind || undefined,
		rawPriority: rawPriority || undefined,
		severity: severity || undefined,
		nextAction: optionalText(row, "next_action"),
	};
}

export function legacyEntityToProject(
	row: Record<string, unknown>,
	activeItems: number,
	knownEntityIds: Set<string>,
): Project | null {
	const id = text(row, "entity_id") || text(row, "id");
	const name = text(row, "name");
	if (!id || !name) {
		return null;
	}

	const rawStatus = text(row, "status");
	const entityType = text(row, "entity_type");
	const organizationId = text(row, "organization_id");
	const parentEntityId = text(row, "parent_entity_id");
	const canonicalRepo = text(row, "canonical_repo");
	const progress = numeric(row, "progress");

	return {
		id,
		name,
		summary: text(row, "summary"),
		status: normalizeProjectStatus(rawStatus),
		parentProjectId: parentEntityId && knownEntityIds.has(parentEntityId) ? parentEntityId : undefined,
		category: text(row, "category") || entityType || "project",
		progress: progress ?? 0,
		progressKnown: progress !== undefined,
		activeItems,
		kanbanStatus: normalizeProjectKanban(rawStatus),
		tags: tags(
			"legacy-adapter",
			entityType ? "entity-type:" + entityType : undefined,
			organizationId ? "organization:" + organizationId : undefined,
			rawStatus ? "raw-status:" + rawStatus : undefined,
		),
		githubRepo: canonicalRepo || undefined,
		rawStatus: rawStatus || undefined,
		rawEntityType: entityType || undefined,
		organizationId: organizationId || undefined,
		parentEntityId: parentEntityId || undefined,
		health: optionalText(row, "health"),
		testReadiness: optionalText(row, "test_readiness"),
		nextAction: optionalText(row, "next_action"),
		canonicalRepo: canonicalRepo || undefined,
	};
}

function placeholderProject(projectId: string, workItems: WorkItem[]): Project {
	const related = workItems.filter((item) => item.projectId === projectId);
	const activeItems = related.filter((item) => item.status !== "done").length;
	return {
		id: projectId,
		name: projectId === "portfolio" ? "Global Portfolio" : projectId,
		summary: "Compatibility node for global work that has no matching entity record.",
		status: "active",
		category: projectId === "portfolio" ? "portfolio_control" : "compatibility",
		progress: 0,
		progressKnown: false,
		activeItems,
		kanbanStatus: activeItems > 0 ? "in_progress" : "done",
		tags: ["legacy-adapter", "synthetic-compatibility-node"],
		rawStatus: "compatibility",
	};
}

export function adaptLegacyGlobalWorkspace(
	entityRows: Record<string, unknown>[],
	workItemRows: Record<string, unknown>[],
): { projects: Project[]; workItems: WorkItem[] } {
	const workItems = workItemRows
		.map(legacyWorkItemToWorkspaceItem)
		.filter((item): item is WorkItem => item !== null);

	const knownEntityIds = new Set(
		entityRows.map((row) => text(row, "entity_id") || text(row, "id")).filter((id) => id.length > 0),
	);
	const activeCounts = new Map<string, number>();
	for (const item of workItems) {
		if (item.status !== "done") {
			activeCounts.set(item.projectId, (activeCounts.get(item.projectId) ?? 0) + 1);
		}
	}

	const projects = entityRows
		.map((row) => {
			const id = text(row, "entity_id") || text(row, "id");
			return legacyEntityToProject(row, activeCounts.get(id) ?? 0, knownEntityIds);
		})
		.filter((project): project is Project => project !== null);

	const projectIds = new Set(projects.map((project) => project.id));
	for (const projectId of new Set(workItems.map((item) => item.projectId))) {
		if (!projectIds.has(projectId)) {
			projects.push(placeholderProject(projectId, workItems));
			projectIds.add(projectId);
		}
	}

	return { projects, workItems };
}
