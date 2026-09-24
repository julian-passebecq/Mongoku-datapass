import type { Project, ProjectStatus, WorkItem, WorkStatus, WorkType, WorkspacePreset } from "./controlPlane";

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

/**
 * Collections that belong to the live global DATAPASSCONTROL graph. Their presence in a
 * database means the workspace-v1 writer must not touch it: `work_items` is shared by name,
 * so a workspace replace would erase the global work queue.
 */
export const LEGACY_GLOBAL_COLLECTIONS = [
	"organizations",
	"entities",
	"repositories",
	"relationships",
	"events",
	"audit_runs",
] as const;

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

/** Returns why workspace writes are refused for this database, or null when it is a pure workspace-v1 namespace. */
export function workspaceWriteBlockReason(collectionNames: Iterable<string>): string | null {
	const names = new Set(collectionNames);
	const legacy = LEGACY_GLOBAL_COLLECTIONS.filter((name) => names.has(name));
	if (legacy.length > 0) {
		return (
			"Control database contains legacy DATAPASSCONTROL graph collections (" +
			legacy.join(", ") +
			"). Workspace writes are refused; initialize a separate workspace-v1 namespace explicitly."
		);
	}
	return null;
}

/**
 * Splits a raw status such as `partial_green` or `not_live_proven` into lowercase tokens so
 * normalization matches whole words instead of substrings (`incomplete` must not read as `complete`).
 */
function statusTokens(rawStatus: string): string[] {
	return rawStatus
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter(Boolean);
}

function hasToken(tokens: string[], candidates: readonly string[]): boolean {
	return tokens.some((token) => candidates.includes(token));
}

/** Qualifiers that mean a positive-looking status is not actually finished. */
const NOT_FINISHED_TOKENS = ["not", "partial", "partially", "pending", "unverified", "incomplete", "unresolved"];

function normalizeProjectStatus(rawStatus: string): ProjectStatus {
	const tokens = statusTokens(rawStatus);
	if (hasToken(tokens, ["stopped", "done", "closed", "archived", "retired"])) {
		return "done";
	}
	if (hasToken(tokens, ["planned", "candidate", "reference", "donor", "paused", "hold"])) {
		return "paused";
	}
	return "active";
}

function normalizeProjectKanban(rawStatus: string): WorkStatus {
	const tokens = statusTokens(rawStatus);
	if (hasToken(tokens, ["stopped", "done", "closed", "archived", "retired"])) {
		return "done";
	}
	if (hasToken(tokens, ["blocked", "blocker", "blocking", "waiting", "awaiting", "wait", "hold"])) {
		return "blocked";
	}
	if (hasToken(tokens, ["planned", "candidate", "reference", "donor", "draft"])) {
		return "backlog";
	}
	if (hasToken(tokens, ["ready", "verify", "review", "test", "testing"])) {
		return "todo";
	}
	return "in_progress";
}

function normalizeWorkStatus(rawStatus: string): WorkStatus {
	const tokens = statusTokens(rawStatus);
	const unfinished = hasToken(tokens, NOT_FINISHED_TOKENS);
	if (!unfinished && hasToken(tokens, ["done", "green", "complete", "completed", "resolved", "mitigated", "closed"])) {
		return "done";
	}
	if (hasToken(tokens, ["blocked", "blocker", "blocking", "waiting", "awaiting", "wait", "hold"])) {
		return "blocked";
	}
	if (hasToken(tokens, ["ongoing", "active", "progress"])) {
		return "in_progress";
	}
	if (hasToken(tokens, ["planned", "backlog", "draft"])) {
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
	const workItems = workItemRows.map(legacyWorkItemToWorkspaceItem).filter((item): item is WorkItem => item !== null);

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

/**
 * Seed presets are app configuration, not live data. On the live graph their project
 * references are advisory: a retired or renamed entity (for example the legacy `foil` node
 * once `foil_project` replaces it) must not invalidate the whole live workspace.
 */
export function bindPresetsToProjects(presets: WorkspacePreset[], projectIds: Set<string>): WorkspacePreset[] {
	return presets.map((preset) => ({
		...preset,
		defaultProjectId:
			preset.defaultProjectId && projectIds.has(preset.defaultProjectId) ? preset.defaultProjectId : undefined,
		tabs: preset.tabs.map((tab) =>
			tab.projectId && !projectIds.has(tab.projectId) ? { ...tab, projectId: undefined } : tab,
		),
	}));
}
