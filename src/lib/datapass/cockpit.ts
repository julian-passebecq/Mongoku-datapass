/**
 * Read-model derivations for the global Home cockpit.
 *
 * Input rows come straight from DATAPASSCONTROL (`organizations`, `entities`, `repositories`,
 * `work_items`, `events`). Nothing here writes, renames or migrates source records: raw values
 * are kept, and data-quality issues are reported as reconciliation findings instead of being
 * silently corrected in UI code.
 */

type Row = Record<string, unknown>;

export type Freshness = "fresh" | "aging" | "stale" | "unknown";

export type RuntimeSurface = {
	provider?: string;
	url?: string;
	/** `production` only when a URL is recorded; otherwise the recorded status or UNKNOWN_TO_VERIFY. */
	urlStatus: string;
	fallbacks: string[];
};

export type CockpitProject = {
	id: string;
	name: string;
	organizationId?: string;
	category?: string;
	entityType?: string;
	status?: string;
	health?: string;
	testReadiness?: string;
	summary?: string;
	repo?: string;
	branch?: string;
	head?: string;
	ci?: { result?: string; runs: string[]; head?: string };
	pullRequest?: { number?: number; state?: string; draft?: boolean };
	runtime?: RuntimeSurface;
	stopPoint?: string;
	nextAction?: string;
	updatedAt?: string;
	lastVerifiedAt?: string;
	freshness: Freshness;
	sourceRefs: string[];
	versions: { current?: string; currentState?: string; target?: string; targetState?: string };
	knowledge?: KnowledgeProjection;
	openWork: number;
	blockedWork: number;
	inactive: boolean;
};

export type KnowledgeProjection = {
	mode: string;
	syncStatus?: string;
	contentAuthority?: string;
	desiredFields: string[];
	prohibitedCopies: string[];
	/** Only present when an overview snapshot has actually been ingested; never inferred. */
	counts?: Record<string, number>;
	lastSnapshotAt?: string;
};

export type WorkCard = {
	id: string;
	projectId: string;
	projectName: string;
	title: string;
	kind?: string;
	priority?: string;
	status: string;
	nextAction?: string;
	observedAt?: string;
	source: "work_item" | "entity_gate";
};

export type RecentEvent = {
	id: string;
	projectId?: string;
	type?: string;
	observedAt?: string;
	summary: string;
	effect?: string;
	superseded: boolean;
};

export type ReconciliationFinding = {
	id: string;
	severity: "review" | "warning";
	title: string;
	detail: string;
	refs: string[];
};

export type Cockpit = {
	projects: CockpitProject[];
	today: WorkCard[];
	resume: CockpitProject[];
	readyToTest: WorkCard[];
	blocked: WorkCard[];
	websites: CockpitProject[];
	knowledge: CockpitProject[];
	recent: RecentEvent[];
	reconciliation: ReconciliationFinding[];
};

export type CockpitInput = {
	organizations: Row[];
	entities: Row[];
	repositories: Row[];
	work: Row[];
	events: Row[];
	now?: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function text(row: Row | undefined, key: string): string {
	const value = row?.[key];
	return value == null ? "" : String(value).trim();
}

function optional(row: Row | undefined, key: string): string | undefined {
	return text(row, key) || undefined;
}

function record(row: Row | undefined, key: string): Row | undefined {
	const value = row?.[key];
	return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : undefined;
}

function strings(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((item) => item != null).map((item) => String(item)) : [];
}

/** Mongo extended JSON (`{ $numberLong: "…" }`) and plain scalars both render as strings. */
function scalar(value: unknown): string | undefined {
	if (value == null) {
		return undefined;
	}
	if (typeof value === "object" && !Array.isArray(value)) {
		const inner = Object.values(value as Row)[0];
		return inner == null ? undefined : String(inner);
	}
	return String(value);
}

export function statusTokens(raw: string): string[] {
	return raw
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter(Boolean);
}

function hasAny(raw: string, tokens: readonly string[]): boolean {
	return statusTokens(raw).some((token) => tokens.includes(token));
}

const DONE_TOKENS = ["done", "closed", "complete", "completed", "resolved", "mitigated", "green", "stopped", "retired"];
const UNFINISHED_TOKENS = ["not", "partial", "partially", "pending", "unverified", "incomplete", "unresolved"];
const BLOCKED_TOKENS = ["blocked", "blocker", "blocking", "waiting", "awaiting", "wait", "hold"];
const READY_TOKENS = ["ready", "verify"];
const INACTIVE_TOKENS = ["stopped", "retired", "archived", "closed", "done"];

export function isDoneStatus(raw: string): boolean {
	return hasAny(raw, DONE_TOKENS) && !hasAny(raw, UNFINISHED_TOKENS);
}

export function isBlockedStatus(raw: string): boolean {
	return hasAny(raw, BLOCKED_TOKENS);
}

function priorityRank(priority: string | undefined): number {
	const match = /^P(\d)/i.exec(priority ?? "");
	return match ? Number(match[1]) : 9;
}

/** Parses bare dates (`2026-09-24`) and ISO timestamps; returns NaN for anything else. */
export function timeOf(value: string | undefined): number {
	if (!value) {
		return Number.NaN;
	}
	return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T00:00:00Z" : value);
}

export function freshnessOf(values: Array<string | undefined>, now: Date): Freshness {
	const times = values.map(timeOf).filter((value) => Number.isFinite(value));
	if (times.length === 0) {
		return "unknown";
	}
	const ageDays = (now.getTime() - Math.max(...times)) / DAY_MS;
	if (ageDays <= 2) {
		return "fresh";
	}
	return ageDays <= 14 ? "aging" : "stale";
}

/**
 * The entity's own `canonical_repo` wins even when that repository row is registered under a
 * family entity (for example AtlasNote's repo row belongs to the `atlas` family).
 */
function canonicalRepository(repositories: Row[], entityId: string, repoName?: string): Row | undefined {
	const byName = repoName ? repositories.find((row) => text(row, "repo") === repoName) : undefined;
	if (byName) {
		return byName;
	}
	const owned = repositories.filter((row) => text(row, "entity_id") === entityId);
	return owned.find((row) => /canonical/i.test(text(row, "role"))) ?? owned[0];
}

function runtimeOf(entity: Row, repository: Row | undefined): RuntimeSurface | undefined {
	const runtime = record(entity, "runtime");
	const url =
		optional(runtime, "production_url") ?? optional(entity, "production_url") ?? optional(repository, "production_url");
	const provider =
		optional(runtime, "production_provider") ??
		optional(runtime, "provider") ??
		optional(entity, "runtime_provider") ??
		optional(repository, "production_provider");
	const fallbacks = strings(runtime?.historical_or_fallback_surfaces);
	const recordedStatus = optional(runtime, "production_url_status");
	const isWebsite = /website/i.test(text(entity, "category") + " " + text(entity, "entity_type"));

	if (!url && !provider && fallbacks.length === 0 && !recordedStatus && !isWebsite) {
		return undefined;
	}
	return {
		provider,
		url,
		urlStatus: url ? "production" : (recordedStatus ?? "UNKNOWN_TO_VERIFY"),
		fallbacks,
	};
}

function knowledgeOf(entity: Row): KnowledgeProjection | undefined {
	const projection = record(entity, "mongoku_projection");
	if (!projection) {
		return undefined;
	}
	const overview = record(projection, "overview");
	const counts = overview
		? Object.fromEntries(
				Object.entries(overview).filter((entry): entry is [string, number] => typeof entry[1] === "number"),
			)
		: undefined;
	return {
		mode: text(projection, "mode") || "UNSPECIFIED",
		syncStatus: optional(projection, "mongo_sync_status"),
		contentAuthority: optional(projection, "content_authority"),
		desiredFields: strings(projection.desired_fields),
		prohibitedCopies: strings(projection.prohibited_default_copy),
		counts: counts && Object.keys(counts).length > 0 ? counts : undefined,
		lastSnapshotAt: optional(overview, "last_snapshot_at") ?? optional(projection, "last_snapshot_at"),
	};
}

export function toCockpitProject(entity: Row, repositories: Row[], work: Row[], now: Date): CockpitProject {
	const id = text(entity, "entity_id") || text(entity, "id");
	const repo = optional(entity, "canonical_repo");
	const repository = canonicalRepository(repositories, id, repo);
	const ci = record(entity, "ci_evidence");
	const pr = record(entity, "pull_request");
	const projectWork = work.filter((item) => text(item, "project_id") === id && !isDoneStatus(text(item, "status")));

	return {
		id,
		name: text(entity, "name") || id,
		organizationId: optional(entity, "organization_id"),
		category: optional(entity, "category"),
		entityType: optional(entity, "entity_type"),
		status: optional(entity, "status"),
		health: optional(entity, "health"),
		testReadiness: optional(entity, "test_readiness"),
		summary: optional(entity, "summary"),
		repo: repo ?? optional(repository, "repo"),
		branch:
			optional(entity, "current_branch") ??
			optional(repository, "active_branch") ??
			optional(repository, "canonical_branch"),
		head:
			optional(entity, "current_head") ??
			optional(entity, "current_repo_head") ??
			optional(repository, "active_head") ??
			optional(record(entity, "runtime"), "repo_head") ??
			optional(record(entity, "runtime"), "repository_head"),
		ci: ci
			? {
					result: optional(ci, "result"),
					head: optional(ci, "head"),
					runs: ["push_run", "pr_run"].map((key) => scalar(ci[key])).filter((value): value is string => !!value),
				}
			: undefined,
		pullRequest: pr
			? {
					number: typeof pr.number === "number" ? pr.number : Number(scalar(pr.number)) || undefined,
					state: optional(pr, "state"),
					draft: typeof pr.draft === "boolean" ? pr.draft : undefined,
				}
			: undefined,
		runtime: runtimeOf(entity, repository),
		stopPoint: optional(repository, "stop_point") ?? optional(entity, "stop_point"),
		nextAction: optional(entity, "next_action"),
		updatedAt: optional(entity, "updated_at"),
		lastVerifiedAt: optional(entity, "last_verified_at"),
		freshness: freshnessOf([optional(entity, "last_verified_at"), optional(entity, "updated_at")], now),
		sourceRefs: strings(entity.source_refs).slice(0, 10),
		versions: {
			current: optional(entity, "current_product_version"),
			currentState: optional(entity, "current_product_state"),
			target: optional(entity, "target_design_version"),
			targetState: optional(entity, "target_design_state"),
		},
		knowledge: knowledgeOf(entity),
		openWork: projectWork.length,
		blockedWork: projectWork.filter((item) => isBlockedStatus(text(item, "status"))).length,
		inactive:
			hasAny(text(entity, "status"), INACTIVE_TOKENS) ||
			hasAny(text(entity, "lifecycle"), ["archived", "retired", "stopped", "proposed"]),
	};
}

function workCard(item: Row, names: Map<string, string>): WorkCard {
	const projectId = text(item, "project_id");
	return {
		id: text(item, "work_item_id") || text(item, "id"),
		projectId,
		projectName: names.get(projectId) ?? projectId,
		title: text(item, "title"),
		kind: optional(item, "kind"),
		priority: optional(item, "priority"),
		status: text(item, "status"),
		nextAction: optional(item, "next_action"),
		observedAt: optional(item, "observed_at") ?? optional(item, "updated_at"),
		source: "work_item",
	};
}

function byPriorityThenRecent(a: WorkCard, b: WorkCard): number {
	return (
		priorityRank(a.priority) - priorityRank(b.priority) ||
		(timeOf(b.observedAt) || 0) - (timeOf(a.observedAt) || 0) ||
		a.id.localeCompare(b.id)
	);
}

function reconciliationFindings(organizations: Row[], entities: Row[], work: Row[]): ReconciliationFinding[] {
	const findings: ReconciliationFinding[] = [];
	const entityById = new Map(entities.map((entity) => [text(entity, "entity_id"), entity]));

	for (const organization of organizations) {
		const organizationId = text(organization, "organization_id");
		const defaultProjectId = text(organization, "default_project_id");
		const roots = entities.filter(
			(entity) => text(entity, "organization_id") === organizationId && !text(entity, "parent_entity_id"),
		);

		// Two root nodes with the same display name inside one organization: usually a legacy
		// macro node that a newer one replaced (FOIL: `foil` vs `foil_project`).
		const byName = new Map<string, Row[]>();
		for (const root of roots) {
			const key = text(root, "name").toLowerCase();
			byName.set(key, [...(byName.get(key) ?? []), root]);
		}
		for (const group of byName.values()) {
			if (group.length < 2) {
				continue;
			}
			const ids = group.map((entity) => text(entity, "entity_id"));
			const nonDefault = ids.filter((id) => id !== defaultProjectId);
			const children = entities
				.filter((entity) => nonDefault.includes(text(entity, "parent_entity_id")))
				.map((entity) => text(entity, "entity_id"));
			findings.push({
				id: "duplicate-root:" + organizationId + ":" + ids.join("+"),
				severity: "review",
				title: organizationId + ": duplicate root nodes " + ids.join(" / "),
				detail:
					"Organization default project is `" +
					(defaultProjectId || "unset") +
					"`" +
					(children.length > 0
						? ", but " + children.join(", ") + " still point to `" + nonDefault.join("`, `") + "`."
						: ".") +
					" Reviewed data reconciliation required; Mongoku does not re-parent or rename.",
				refs: [...ids, ...children],
			});
		}

		// Company navigation anchored on a single product entity.
		const defaultEntity = entityById.get(defaultProjectId);
		if (defaultEntity && text(defaultEntity, "entity_type") !== "project") {
			findings.push({
				id: "default-project-type:" + organizationId,
				severity: "review",
				title: organizationId + ": default project is a " + text(defaultEntity, "entity_type") + " entity",
				detail:
					"Organization `" +
					organizationId +
					"` uses `" +
					defaultProjectId +
					"` (" +
					(text(defaultEntity, "name") || defaultProjectId) +
					") as its default project, conflating company navigation with one product. A macro node would need an explicit reviewed migration; legacy IDs stay untouched.",
				refs: [organizationId, defaultProjectId],
			});
		}
	}

	// Conflicting gate signals between an entity and its own test work item.
	for (const entity of entities) {
		const id = text(entity, "entity_id");
		if (!/^READY/i.test(text(entity, "test_readiness"))) {
			continue;
		}
		for (const item of work) {
			if (text(item, "project_id") === id && text(item, "kind") === "test" && isBlockedStatus(text(item, "status"))) {
				findings.push({
					id: "gate-conflict:" + id + ":" + text(item, "work_item_id"),
					severity: "warning",
					title: id + ": entity says " + text(entity, "test_readiness") + ", test item is " + text(item, "status"),
					detail:
						"Work item `" +
						text(item, "work_item_id") +
						"` (observed " +
						(text(item, "observed_at") || "unknown") +
						") may be stale relative to the entity (updated " +
						(text(entity, "updated_at") || "unknown") +
						"). Verify against source evidence before changing either record.",
					refs: [id, text(item, "work_item_id")],
				});
			}
		}
	}

	return findings;
}

export function buildCockpit(input: CockpitInput): Cockpit {
	const now = input.now ?? new Date();
	const projects = input.entities
		.map((entity) => toCockpitProject(entity, input.repositories, input.work, now))
		.filter((project) => project.id);
	const names = new Map(projects.map((project) => [project.id, project.name]));
	const openWork = input.work.filter((item) => !isDoneStatus(text(item, "status")));
	const cards = openWork.map((item) => workCard(item, names));

	const readyWork = cards.filter((card) => card.kind === "test" && hasAny(card.status, READY_TOKENS));
	const testedProjects = new Set(readyWork.map((card) => card.projectId));
	const entityGates: WorkCard[] = projects
		.filter((project) => /^READY/i.test(project.testReadiness ?? "") && !testedProjects.has(project.id))
		.map((project) => ({
			id: "gate:" + project.id,
			projectId: project.id,
			projectName: project.name,
			title: project.testReadiness ?? "",
			status: project.testReadiness ?? "",
			nextAction: project.nextAction,
			observedAt: project.lastVerifiedAt ?? project.updatedAt,
			source: "entity_gate",
		}));
	const readyToTest = [...readyWork, ...entityGates].sort(byPriorityThenRecent);

	const blocked = cards.filter((card) => isBlockedStatus(card.status)).sort(byPriorityThenRecent);

	const today = [
		...readyWork.filter((card) => priorityRank(card.priority) === 0),
		...cards.filter(
			(card) =>
				priorityRank(card.priority) === 0 &&
				card.kind !== "test" &&
				!isBlockedStatus(card.status) &&
				hasAny(card.status, ["ready", "ongoing", "active", "open", "todo"]),
		),
	]
		.sort(byPriorityThenRecent)
		.slice(0, 6);

	const resume = projects
		.filter((project) => !project.inactive && project.nextAction)
		.sort(
			(a, b) =>
				(timeOf(b.lastVerifiedAt ?? b.updatedAt) || 0) - (timeOf(a.lastVerifiedAt ?? a.updatedAt) || 0) ||
				a.name.localeCompare(b.name),
		)
		.slice(0, 6);

	const recent = input.events
		.map((event) => ({
			id: text(event, "event_id") || text(event, "_id"),
			projectId: optional(event, "project_id"),
			type: optional(event, "event_type"),
			observedAt: optional(event, "observed_at"),
			summary: text(event, "summary"),
			effect: optional(event, "effect"),
			superseded: !!text(event, "superseded_by"),
		}))
		.sort((a, b) => (timeOf(b.observedAt) || 0) - (timeOf(a.observedAt) || 0))
		.slice(0, 8);

	return {
		projects,
		today,
		resume,
		readyToTest,
		blocked,
		websites: projects.filter((project) => project.runtime),
		knowledge: projects.filter((project) => project.knowledge),
		recent,
		reconciliation: reconciliationFindings(input.organizations, input.entities, input.work),
	};
}
