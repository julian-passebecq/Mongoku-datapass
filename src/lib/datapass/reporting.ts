export type SourceProvider = "MONGODB_ATLAS" | "GITHUB" | "VERCEL" | "DATABRICKS" | "FABRIC" | "OBJECT_STORAGE";

export type SourceDescriptor = {
	id: string;
	authority: string;
	provider: SourceProvider;
	adapter: "MONGODB";
	resourceRef: string;
	database?: string;
	readOnly: true;
	defaultRoute: boolean;
	description: string;
	aliases?: string[];
	registryAuthority?: string;
};

export type ReportParameter = {
	name: string;
	type: "string" | "string[]" | "date" | "boolean";
	required?: boolean;
};

/**
 * `inventory` resolves the source like any step, then lists its collections with estimated
 * counts (listCollections + count, both granted by the `read` role). `collection` is ignored.
 */
export type ReportOperation = "find" | "aggregate" | "inventory";

export type ReportQueryStep = {
	id: string;
	sourceId: string;
	authority: string;
	collection: string;
	operation: ReportOperation;
	filter?: Record<string, unknown>;
	projection?: Record<string, unknown>;
	pipeline?: Record<string, unknown>[];
	sort?: Record<string, 1 | -1>;
	limit?: number;
	parameters?: ReportParameter[];
	optional?: boolean;
	label: string;
};

export type ReportPresentation =
	| "dashboard"
	| "kanban"
	| "table"
	| "timeline"
	| "calendar"
	| "questions"
	| "propagation"
	| "resources"
	| "documents"
	| "architecture"
	| "status";

export type ReportDefinition = {
	id: string;
	title: string;
	description: string;
	scope: "GLOBAL" | "FOIL";
	routeId: string;
	readOnly: true;
	presentation: ReportPresentation;
	refreshPolicy: {
		mode: "manual" | "on-open" | "ttl";
		ttlSeconds?: number;
	};
	parameters?: ReportParameter[];
	steps: ReportQueryStep[];
	tags: string[];
};

export type ResourceRegistryTrace = {
	found: boolean;
	registryAuthority: string;
	resourceId?: string;
	canonicalName?: string;
	providerName?: string;
	aliases?: string[];
	resourceKind?: string;
	authorityRole?: string;
	provider?: string;
	projectId?: string;
	cluster?: string;
	clusterId?: string;
	database?: string;
	repository?: string;
	repositoryId?: string;
	providerResourceId?: string;
	status?: string;
	defaultRoute?: boolean;
	lastVerifiedAt?: string;
};

export type ReportSourceTrace = {
	reportId: string;
	stepId: string;
	sourceId: string;
	authority: string;
	resourceRef: string;
	provider: SourceProvider;
	database?: string;
	collection: string;
	operation: ReportOperation;
	readOnly: true;
	resolved: boolean;
	resourceRegistry?: ResourceRegistryTrace;
	message?: string;
};

export type ReportSectionState =
	| "OK"
	| "EMPTY"
	| "TRUNCATED"
	| "SOURCE_UNBOUND"
	| "REGISTERED_UNBOUND"
	| "REGISTRY_UNAVAILABLE"
	| "SOURCE_ERROR";

export type ReportSectionMeta = {
	state: ReportSectionState;
	requestedLimit?: number;
	effectiveLimit?: number;
	returnedRows: number;
	responseBytes: number;
	truncated: boolean;
};

export type ReportSection = {
	id: string;
	label: string;
	authority: string;
	sourceId: string;
	rows: Record<string, unknown>[];
	trace: ReportSourceTrace;
	meta?: ReportSectionMeta;
};

export type ReportResult = {
	reportId: string;
	title: string;
	description: string;
	presentation: ReportPresentation;
	generatedAt: string;
	readOnly: true;
	sections: ReportSection[];
};

export const sourceCatalog: SourceDescriptor[] = [
	{
		id: "DATAPROJECTS_GLOBAL",
		authority: "DATAPASSCONTROL",
		provider: "MONGODB_ATLAS",
		adapter: "MONGODB",
		resourceRef: "DATAPASSCONTROL/ClusterDP/dataprojects_control",
		database: "dataprojects_control",
		readOnly: true,
		defaultRoute: true,
		description: "Global Julian project portfolio/cartography. Never detailed FOIL task authority.",
	},
	{
		id: "FOIL_PM",
		authority: "FOIL Project Management",
		provider: "MONGODB_ATLAS",
		adapter: "MONGODB",
		resourceRef: "RES-MONGO-DB-PM",
		database: "foil_project_management",
		readOnly: true,
		defaultRoute: true,
		registryAuthority: "FOIL_PM",
		description: "Canonical FOIL project/resource router and backlog authority.",
	},
	{
		id: "FOIL_CORE",
		authority: "FOIL Core Truth",
		provider: "MONGODB_ATLAS",
		adapter: "MONGODB",
		resourceRef: "RES-MONGO-DB-CORE-CONTROL",
		database: "foil_control",
		readOnly: true,
		defaultRoute: true,
		registryAuthority: "FOIL_PM",
		description: "Canonical accepted machine, engineering, evidence and control truth.",
	},
	{
		id: "FOIL_STUDY",
		authority: "FOIL STUDY",
		provider: "MONGODB_ATLAS",
		adapter: "MONGODB",
		resourceRef: "RES-MONGO-DB-FOIL-STUDY",
		database: "foil_study",
		readOnly: true,
		defaultRoute: true,
		registryAuthority: "FOIL_PM",
		description: "Detailed scientific-study and literature decomposition authority.",
	},
	{
		id: "FOIL_AI_REASONING",
		authority: "FOIL AI Reasoning",
		provider: "MONGODB_ATLAS",
		adapter: "MONGODB",
		resourceRef: "RES-MONGODB-FOIL-AI-REASONING",
		database: "foil_ai_reasoning",
		readOnly: true,
		defaultRoute: true,
		aliases: ["FOIL AI Thinkink"],
		registryAuthority: "FOIL_PM",
		description: "Non-authoritative AI reasoning, hypotheses, uncertainty and validation plans.",
	},
	{
		id: "FOIL_IT_DEV",
		authority: "FOIL IT DEV",
		provider: "MONGODB_ATLAS",
		adapter: "MONGODB",
		resourceRef: "RES-MONGO-DB-IT-DEV",
		database: "foil_it_dev",
		readOnly: true,
		defaultRoute: true,
		registryAuthority: "FOIL_PM",
		description: "Software/cloud/data architecture and integration authority.",
	},
	{
		id: "FOIL_FRONT",
		authority: "FOIL FRONT",
		provider: "MONGODB_ATLAS",
		adapter: "MONGODB",
		resourceRef: "RES-MONGO-DB-FRONT",
		database: "foil_front",
		readOnly: true,
		defaultRoute: true,
		registryAuthority: "FOIL_PM",
		description: "Application UX, front-end and visual-state authority.",
	},
	{
		id: "FOIL_WORK_ARCHIVE",
		authority: "FOIL Work Archive",
		provider: "MONGODB_ATLAS",
		adapter: "MONGODB",
		resourceRef: "RES-MONGO-DB-WORK-ARCHIVE",
		database: "foil_work_archive",
		readOnly: true,
		defaultRoute: true,
		registryAuthority: "FOIL_PM",
		description: "Provenance, work history and artifact metadata authority.",
	},
	{
		id: "FOIL_DATABRICKS",
		authority: "FOIL Databricks Lab",
		provider: "MONGODB_ATLAS",
		adapter: "MONGODB",
		resourceRef: "RES-MONGO-DB-DATABRICKS-LAB",
		database: "foil_lab",
		readOnly: true,
		defaultRoute: true,
		registryAuthority: "FOIL_PM",
		description: "Databricks lab control metadata; runtime/Gold/MLflow remain runtime authorities.",
	},
	{
		id: "FOIL_FABRIC",
		authority: "FOIL Ms Fabric",
		provider: "MONGODB_ATLAS",
		adapter: "MONGODB",
		resourceRef: "RES-MONGO-DB-FABRIC",
		database: "foil_fabric_lab",
		readOnly: true,
		defaultRoute: true,
		registryAuthority: "FOIL_PM",
		description: "Fabric-specific lab/runtime control metadata.",
	},
];

const pmBacklogProjection = {
	_id: 1,
	projectId: 1,
	priority: 1,
	status: 1,
	category: 1,
	title: 1,
	currentStep: 1,
	nextAction: 1,
	blocker: 1,
	blockers: 1,
	authority: 1,
	authorityRefs: 1,
	targetReviewDate: 1,
	nextReviewAt: 1,
	nextDueAt: 1,
	dueDate: 1,
	updatedAt: 1,
	dependencies: 1,
	relatedAuthorities: 1,
	impactTargets: 1,
	propagationStatus: 1,
	propagationPriority: 1,
	tasks: 1,
	schedule: 1,
	ownerAuthority: 1,
	reportRefs: 1,
};

/**
 * FOIL authority records keep superseded and historical entries for provenance
 * (`SUPERSEDED_BY_V3`, `HISTORICAL_CANDIDATE`, `CANCELLED_DEFERRED`, `MIGRATED_SOURCE_PARENT`,
 * `..._SUPERSEDED_BY_...`). "Current" sections leave them out; SOURCE_INVENTORY still counts them.
 */
const CURRENT_RECORDS = {
	status: { $not: { $regex: "SUPERSEDED|CANCELLED|HISTORICAL|LEGACY|MIGRATED" } },
};

export const reportCatalog: ReportDefinition[] = [
	{
		id: "GLOBAL_PROJECTS",
		title: "Global projects",
		description: "Portfolio-level project cartography only.",
		scope: "GLOBAL",
		routeId: "global-projects",
		readOnly: true,
		presentation: "dashboard",
		refreshPolicy: { mode: "ttl", ttlSeconds: 120 },
		steps: [
			{
				id: "organizations",
				sourceId: "DATAPROJECTS_GLOBAL",
				authority: "DATAPASSCONTROL",
				collection: "organizations",
				operation: "find",
				filter: {},
				sort: { name: 1 },
				limit: 100,
				optional: true,
				label: "Organizations",
			},
			{
				id: "entities",
				sourceId: "DATAPROJECTS_GLOBAL",
				authority: "DATAPASSCONTROL",
				collection: "entities",
				operation: "find",
				filter: {},
				sort: { updated_at: -1 },
				limit: 250,
				label: "Projects",
			},
			{
				id: "relationships",
				sourceId: "DATAPROJECTS_GLOBAL",
				authority: "DATAPASSCONTROL",
				collection: "relationships",
				operation: "find",
				filter: {},
				sort: { relationship_id: 1 },
				limit: 500,
				optional: true,
				label: "Portfolio relationships",
			},
			{
				id: "work",
				sourceId: "DATAPROJECTS_GLOBAL",
				authority: "DATAPASSCONTROL",
				collection: "work_items",
				operation: "find",
				filter: { status: { $nin: ["done", "DONE", "closed", "CLOSED"] } },
				sort: { priority: 1, observed_at: -1 },
				limit: 200,
				label: "Portfolio work",
			},
			{
				id: "audits",
				sourceId: "DATAPROJECTS_GLOBAL",
				authority: "DATAPASSCONTROL",
				collection: "audit_runs",
				operation: "find",
				filter: {},
				sort: { observed_at: -1, created_at: -1 },
				limit: 100,
				label: "Recent audits",
			},
			{
				id: "repositories",
				sourceId: "DATAPROJECTS_GLOBAL",
				authority: "DATAPASSCONTROL",
				collection: "repositories",
				operation: "find",
				filter: {},
				sort: { last_reviewed: -1 },
				limit: 300,
				label: "Canonical repositories",
			},
			{
				id: "events",
				sourceId: "DATAPROJECTS_GLOBAL",
				authority: "DATAPASSCONTROL",
				collection: "events",
				operation: "find",
				filter: {},
				projection: {
					_id: 0,
					event_id: 1,
					event_type: 1,
					project_id: 1,
					observed_at: 1,
					summary: 1,
					effect: 1,
					source: 1,
					superseded_by: 1,
				},
				sort: { observed_at: -1 },
				limit: 30,
				optional: true,
				label: "Recent portfolio events",
			},
		],
		tags: ["global", "projects"],
	},
	{
		id: "FOIL_STATUS_NOW",
		title: "FOIL status now",
		description: "PM scorecards, P0 attention and recent authoritative project events.",
		scope: "FOIL",
		routeId: "status",
		readOnly: true,
		presentation: "status",
		refreshPolicy: { mode: "on-open" },
		steps: [
			{
				id: "scorecards",
				sourceId: "FOIL_PM",
				authority: "FOIL Project Management",
				collection: "portfolio",
				operation: "find",
				filter: {},
				projection: { _id: 1, name: 1, status: 1, priority: 1, phase: 1, nextAction: 1, scorecard: 1, updatedAt: 1 },
				sort: { priority: 1, updatedAt: -1 },
				limit: 100,
				label: "PM scorecards",
			},
			{
				id: "p0",
				sourceId: "FOIL_PM",
				authority: "FOIL Project Management",
				collection: "backlog",
				operation: "find",
				filter: {
					$or: [
						{ priority: { $regex: "^P0", $options: "i" } },
						{ tasks: { $elemMatch: { priority: { $regex: "^P0", $options: "i" } } } },
					],
				},
				projection: pmBacklogProjection,
				sort: { updatedAt: -1 },
				limit: 50,
				label: "P0 attention",
			},
		],
		tags: ["foil", "today", "status"],
	},
	{
		id: "FOIL_NEXT",
		title: "FOIL next",
		description: "Actionable PM backlog ordered by priority; blocked/waiting are retained and visibly classified.",
		scope: "FOIL",
		routeId: "next",
		readOnly: true,
		presentation: "kanban",
		refreshPolicy: { mode: "on-open" },
		steps: [
			{
				id: "backlog",
				sourceId: "FOIL_PM",
				authority: "FOIL Project Management",
				collection: "backlog",
				operation: "find",
				filter: { status: { $nin: ["DONE", "done", "CLOSED", "closed"] } },
				projection: pmBacklogProjection,
				sort: { priority: 1, updatedAt: -1 },
				limit: 300,
				label: "Authoritative backlog",
			},
		],
		tags: ["foil", "next", "backlog"],
	},
	{
		id: "FOIL_RECENT",
		title: "FOIL recent",
		description: "Recent PM events and Work Archive activity without duplicating provenance.",
		scope: "FOIL",
		routeId: "recent",
		readOnly: true,
		presentation: "timeline",
		refreshPolicy: { mode: "ttl", ttlSeconds: 60 },
		steps: [
			{
				id: "pm-events",
				sourceId: "FOIL_PM",
				authority: "FOIL Project Management",
				collection: "events",
				operation: "find",
				filter: {},
				sort: { occurredAt: -1 },
				limit: 40,
				label: "Project events",
			},
			{
				id: "archive-activity",
				sourceId: "FOIL_WORK_ARCHIVE",
				authority: "FOIL Work Archive",
				collection: "activity_log",
				operation: "find",
				filter: {},
				sort: { occurredAt: -1 },
				limit: 40,
				optional: true,
				label: "Archive activity",
			},
		],
		tags: ["foil", "recent", "provenance"],
	},
	{
		id: "FOIL_P0_BLOCKERS",
		title: "FOIL P0 blockers",
		description: "Unresolved critical blockers from PM only.",
		scope: "FOIL",
		routeId: "p0-blockers",
		readOnly: true,
		presentation: "table",
		refreshPolicy: { mode: "on-open" },
		steps: [
			{
				id: "blockers",
				sourceId: "FOIL_PM",
				authority: "FOIL Project Management",
				collection: "backlog",
				operation: "find",
				filter: {
					$or: [
						{
							priority: { $regex: "^P0", $options: "i" },
							status: { $regex: "BLOCK|WAIT|HOLD", $options: "i" },
						},
						{
							tasks: {
								$elemMatch: {
									priority: { $regex: "^P0", $options: "i" },
									status: { $regex: "BLOCK|WAIT|HOLD", $options: "i" },
								},
							},
						},
					],
				},
				projection: pmBacklogProjection,
				sort: { updatedAt: -1 },
				limit: 100,
				label: "Critical blockers",
			},
		],
		tags: ["foil", "blockers", "p0"],
	},
	{
		id: "FOIL_PROPAGATION_PENDING",
		title: "Pending propagation",
		description:
			"Impact metadata stored on FOIL Project Management events. Missing legacy metadata is shown separately from explicit NO_IMPACT.",
		scope: "FOIL",
		routeId: "propagation",
		readOnly: true,
		presentation: "propagation",
		refreshPolicy: { mode: "on-open" },
		steps: [
			{
				id: "pending",
				sourceId: "FOIL_PM",
				authority: "FOIL Project Management",
				collection: "events",
				operation: "find",
				filter: {
					$or: [
						{
							propagationStatus: {
								$in: [
									"NEW_INPUT",
									"CLASSIFIED",
									"PRIMARY_AUTHORITY_UPDATED",
									"IMPACT_ANALYZED",
									"DEPENDENT_TARGETS_DIRTY",
									"DEFERRED",
									"READY_TO_PROPAGATE",
									"APPLIED",
									"VERIFY_REQUIRED",
								],
							},
						},
						{
							impactTargets: {
								$elemMatch: { status: { $in: ["DIRTY", "REVIEW_REQUIRED", "READY_TO_PROPAGATE", "VERIFY_REQUIRED"] } },
							},
						},
						{
							impactTargets: {
								$elemMatch: { state: { $in: ["DIRTY", "REVIEW_REQUIRED", "READY_TO_PROPAGATE", "VERIFY_REQUIRED"] } },
							},
						},
					],
				},
				sort: { propagationPriority: 1, occurredAt: -1, updatedAt: -1 },
				limit: 250,
				label: "Pending propagation",
			},
			{
				id: "unassessed",
				sourceId: "FOIL_PM",
				authority: "FOIL Project Management",
				collection: "events",
				operation: "find",
				filter: {
					propagationStatus: { $exists: false },
					impactTargets: { $exists: false },
				},
				projection: {
					_id: 1,
					eventType: 1,
					title: 1,
					summary: 1,
					sourceRef: 1,
					relatedPortfolioIds: 1,
					occurredAt: 1,
					updatedAt: 1,
					status: 1,
				},
				sort: { occurredAt: -1, updatedAt: -1 },
				limit: 100,
				label: "Unassessed / legacy propagation metadata",
			},
		],
		tags: ["foil", "impact", "propagation", "events"],
	},
	{
		id: "FOIL_APPS_IMPACTED",
		title: "FOIL apps impacted",
		description: "Impacted products derived from pending propagation metadata on PM events.",
		scope: "FOIL",
		routeId: "apps-impacted",
		readOnly: true,
		presentation: "propagation",
		refreshPolicy: { mode: "on-open" },
		steps: [
			{
				id: "impact",
				sourceId: "FOIL_PM",
				authority: "FOIL Project Management",
				collection: "events",
				operation: "find",
				filter: {
					$or: [
						{
							propagationStatus: {
								$in: ["DEPENDENT_TARGETS_DIRTY", "DEFERRED", "READY_TO_PROPAGATE", "APPLIED", "VERIFY_REQUIRED"],
							},
						},
						{
							impactTargets: {
								$elemMatch: { status: { $in: ["DIRTY", "REVIEW_REQUIRED", "READY_TO_PROPAGATE", "VERIFY_REQUIRED"] } },
							},
						},
						{
							impactTargets: {
								$elemMatch: { state: { $in: ["DIRTY", "REVIEW_REQUIRED", "READY_TO_PROPAGATE", "VERIFY_REQUIRED"] } },
							},
						},
					],
				},
				projection: {
					_id: 1,
					eventType: 1,
					title: 1,
					sourceRef: 1,
					backlogRefs: 1,
					backlogRef: 1,
					sourceRevision: 1,
					impactTargets: 1,
					propagationStatus: 1,
					propagationPriority: 1,
					detectedAt: 1,
					occurredAt: 1,
					requiredBy: 1,
					appliedRefs: 1,
					verificationRefs: 1,
				},
				sort: { propagationPriority: 1, occurredAt: -1, updatedAt: -1 },
				limit: 250,
				label: "Impacted applications",
			},
		],
		tags: ["foil", "apps", "impact", "events"],
	},
	{
		id: "FOIL_FRANCIS_QUESTIONS",
		title: "Questions for Francis",
		description: "Structured stakeholder questions. Optional until the PM questions collection exists.",
		scope: "FOIL",
		routeId: "questions-francis",
		readOnly: true,
		presentation: "questions",
		refreshPolicy: { mode: "on-open" },
		steps: [
			{
				id: "questions",
				sourceId: "FOIL_PM",
				authority: "FOIL Project Management",
				collection: "stakeholder_questions",
				operation: "find",
				filter: { stakeholder: { $regex: "Francis", $options: "i" }, status: { $nin: ["RESOLVED", "SUPERSEDED"] } },
				sort: { priority: 1, nextReviewAt: 1 },
				limit: 250,
				optional: true,
				label: "Unresolved questions",
			},
		],
		tags: ["foil", "questions", "francis"],
	},
	{
		id: "FOIL_MAINTENANCE_DUE",
		title: "FOIL maintenance due",
		description:
			"Recurring review/audit/backup/check work that PM says needs attention. Does not execute audit systems.",
		scope: "FOIL",
		routeId: "maintenance",
		readOnly: true,
		presentation: "calendar",
		refreshPolicy: { mode: "on-open" },
		steps: [
			{
				id: "maintenance",
				sourceId: "FOIL_PM",
				authority: "FOIL Project Management",
				collection: "backlog",
				operation: "find",
				filter: {
					$or: [
						{ "schedule.type": { $in: ["RECURRING", "CONDITION_REVIEW"] } },
						{ category: { $in: ["RECURRING_CONTROL", "PROPAGATION_CONTROL"] } },
						{ targetReviewDate: { $exists: true } },
						{ nextReviewAt: { $exists: true } },
						{ nextDueAt: { $exists: true } },
					],
				},
				projection: pmBacklogProjection,
				sort: { "schedule.nextDueAt": 1, targetReviewDate: 1, priority: 1 },
				limit: 200,
				label: "Maintenance and reviews",
			},
		],
		tags: ["foil", "maintenance", "calendar"],
	},
	{
		id: "FOIL_CONTRADICTIONS",
		title: "FOIL contradictions",
		description: "Open technical/evidence contradictions from Core Truth; no reasoning promotion is implied.",
		scope: "FOIL",
		routeId: "contradictions",
		readOnly: true,
		presentation: "table",
		refreshPolicy: { mode: "on-open" },
		steps: [
			{
				id: "core-conflicts",
				sourceId: "FOIL_CORE",
				authority: "FOIL Core Truth",
				collection: "work_items",
				operation: "find",
				filter: {
					$or: [
						{ kind: { $regex: "CONFLICT|CONTRAD", $options: "i" } },
						{ _id: { $regex: "^CONFLICT", $options: "i" } },
					],
					status: { $nin: ["resolved", "RESOLVED", "closed", "CLOSED", "superseded", "SUPERSEDED"] },
				},
				sort: { priority: 1, updatedAt: -1 },
				limit: 150,
				label: "Core Truth conflicts",
			},
			{
				id: "study-assessments",
				sourceId: "FOIL_STUDY",
				authority: "FOIL STUDY",
				collection: "claim_assessments",
				operation: "find",
				filter: {
					$or: [
						{ "contradictionsAndGaps.0": { $exists: true } },
						{ openChecks: { $elemMatch: { status: { $nin: ["RESOLVED", "DONE", "CLOSED"] } } } },
					],
				},
				sort: { updatedAt: -1 },
				limit: 150,
				optional: true,
				label: "STUDY claim assessments",
			},
		],
		tags: ["foil", "evidence", "contradictions"],
	},
	{
		id: "FOIL_ARCHITECTURE_MAP",
		title: "FOIL architecture map",
		description: "Authority/routing and resource inventory views. Graph semantics remain separated in the UI.",
		scope: "FOIL",
		routeId: "architecture",
		readOnly: true,
		presentation: "architecture",
		refreshPolicy: { mode: "ttl", ttlSeconds: 300 },
		steps: [
			{
				id: "routing",
				sourceId: "FOIL_PM",
				authority: "FOIL Project Management",
				collection: "architecture_index",
				operation: "find",
				filter: {},
				sort: { updatedAt: -1 },
				limit: 100,
				label: "Authority and routing",
			},
			{
				id: "resources",
				sourceId: "FOIL_PM",
				authority: "FOIL Project Management",
				collection: "resource_registry",
				operation: "find",
				filter: { hiddenByDefault: { $ne: true } },
				sort: { kind: 1, name: 1 },
				limit: 500,
				label: "Canonical resource inventory",
			},
		],
		tags: ["foil", "architecture", "routing", "resources"],
	},
	{
		id: "FOIL_PROJECTS",
		title: "FOIL projects",
		description: "All PM portfolios/apps/studies and their current scorecards.",
		scope: "FOIL",
		routeId: "projects",
		readOnly: true,
		presentation: "table",
		refreshPolicy: { mode: "ttl", ttlSeconds: 120 },
		steps: [
			{
				id: "portfolio",
				sourceId: "FOIL_PM",
				authority: "FOIL Project Management",
				collection: "portfolio",
				operation: "find",
				filter: {},
				sort: { priority: 1, updatedAt: -1 },
				limit: 250,
				label: "FOIL portfolio",
			},
		],
		tags: ["foil", "projects", "portfolio"],
	},
	{
		id: "FOIL_RESOURCE_INVENTORY",
		title: "FOIL resource inventory",
		description: "Canonical PM resource_registry. Provider enumeration is verification/discovery only.",
		scope: "FOIL",
		routeId: "resources",
		readOnly: true,
		presentation: "resources",
		refreshPolicy: { mode: "ttl", ttlSeconds: 300 },
		steps: [
			{
				id: "registry",
				sourceId: "FOIL_PM",
				authority: "FOIL Project Management",
				collection: "resource_registry",
				operation: "find",
				filter: { hiddenByDefault: { $ne: true } },
				sort: { kind: 1, name: 1 },
				limit: 750,
				label: "PM resource registry",
			},
		],
		tags: ["foil", "resources", "registry"],
	},
	{
		id: "FOIL_DOCUMENTS_RECENT",
		title: "Recent FOIL documents",
		description: "Recent Work Archive artifact metadata only; large binaries remain external.",
		scope: "FOIL",
		routeId: "documents",
		readOnly: true,
		presentation: "documents",
		refreshPolicy: { mode: "ttl", ttlSeconds: 120 },
		steps: [
			{
				id: "artifacts",
				sourceId: "FOIL_WORK_ARCHIVE",
				authority: "FOIL Work Archive",
				collection: "artifacts",
				operation: "find",
				filter: {},
				projection: {
					_id: 1,
					artifactId: 1,
					artifactType: 1,
					fileName: 1,
					mediaType: 1,
					byteSize: 1,
					sha256: 1,
					project: 1,
					technology: 1,
					category: 1,
					date: 1,
					source: 1,
					confidentiality: 1,
					authority: 1,
					status: 1,
					storageStatus: 1,
					storageProvider: 1,
					bucket: 1,
					objectKey: 1,
					versionId: 1,
					downloadRef: 1,
					previewRef: 1,
					textExtractionRef: 1,
					studyRefs: 1,
					coreRefs: 1,
					createdAt: 1,
					repository: 1,
					branch: 1,
					commit: 1,
					binaryPersistence: 1,
					durableExternalCopy: 1,
				},
				sort: { createdAt: -1 },
				limit: 150,
				label: "Artifact metadata",
			},
		],
		tags: ["foil", "documents", "archive"],
	},
	{
		id: "FOIL_INSTRUCTION_DRIFT",
		title: "FOIL instruction drift",
		description: "Canonical Project Agent/instruction version versus observed/confirmed ChatGPT Project UI state.",
		scope: "FOIL",
		routeId: "instruction-drift",
		readOnly: true,
		presentation: "status",
		refreshPolicy: { mode: "on-open" },
		steps: [
			{
				id: "instruction-state",
				sourceId: "FOIL_PM",
				authority: "FOIL Project Management",
				collection: "architecture_index",
				operation: "find",
				filter: {
					$or: [
						{ projectUiSyncStatus: { $exists: true } },
						{ projectUiObservedVersion: { $exists: true } },
						{ agentInstructionVersion: { $exists: true } },
					],
				},
				projection: {
					_id: 1,
					name: 1,
					version: 1,
					agentInstructionVersion: 1,
					agentInstructionRef: 1,
					projectUiLastConfirmedVersion: 1,
					projectUiObservedVersion: 1,
					projectUiTargetVersion: 1,
					projectUiSyncStatus: 1,
					projectUiSyncRequiredAt: 1,
					projectUiSyncGateRef: 1,
					updatedAt: 1,
				},
				sort: { updatedAt: -1 },
				limit: 100,
				label: "Instruction synchronization",
			},
		],
		tags: ["foil", "instructions", "drift"],
	},
	{
		id: "FOIL_KANBAN",
		title: "FOIL backlog Kanban",
		description: "Pure view over foil_project_management.backlog. No card is copied into Mongoku work_items.",
		scope: "FOIL",
		routeId: "kanban",
		readOnly: true,
		presentation: "kanban",
		refreshPolicy: { mode: "on-open" },
		steps: [
			{
				id: "backlog",
				sourceId: "FOIL_PM",
				authority: "FOIL Project Management",
				collection: "backlog",
				operation: "find",
				filter: {},
				sort: { priority: 1, updatedAt: -1 },
				limit: 500,
				label: "Authoritative FOIL backlog",
			},
		],
		tags: ["foil", "kanban", "backlog"],
	},
	{
		id: "FOIL_CALENDAR",
		title: "FOIL calendar",
		description:
			"PM review/due scheduling. External Audit and Self-Audit are displayed only; opening this report never executes them.",
		scope: "FOIL",
		routeId: "calendar",
		readOnly: true,
		presentation: "calendar",
		refreshPolicy: { mode: "on-open" },
		steps: [
			{
				id: "scheduled-backlog",
				sourceId: "FOIL_PM",
				authority: "FOIL Project Management",
				collection: "backlog",
				operation: "find",
				filter: {
					$or: [
						{ schedule: { $exists: true } },
						{ targetReviewDate: { $exists: true } },
						{ nextReviewAt: { $exists: true } },
						{ nextDueAt: { $exists: true } },
					],
				},
				projection: pmBacklogProjection,
				sort: { "schedule.nextDueAt": 1, targetReviewDate: 1, nextReviewAt: 1, nextDueAt: 1 },
				limit: 250,
				label: "Scheduled PM work",
			},
		],
		tags: ["foil", "calendar", "maintenance"],
	},
	{
		id: "FOIL_GLOBAL_REFERENCES",
		title: "Global FOIL references",
		description:
			"Global DATAPASSCONTROL records that mention FOIL. These are portfolio work or references, never the detailed FOIL backlog authority.",
		scope: "FOIL",
		routeId: "global-references",
		readOnly: true,
		presentation: "table",
		refreshPolicy: { mode: "ttl", ttlSeconds: 120 },
		steps: [
			{
				id: "global-work",
				sourceId: "DATAPROJECTS_GLOBAL",
				authority: "DATAPASSCONTROL",
				collection: "work_items",
				operation: "find",
				// Every FOIL-organization entity id starts with `foil` (foil_project, foil_it_dev,
				// foil_wind, the retired `foil` alias), so re-pointing work between them keeps it here.
				filter: { project_id: { $regex: "^foil(_|$)" } },
				sort: { observed_at: -1 },
				limit: 100,
				label: "Global portfolio references",
			},
		],
		tags: ["foil", "global", "references"],
	},
	{
		id: "FOIL_AI_REASONING_RECENT",
		title: "FOIL AI Reasoning — recent (non-authoritative)",
		description:
			"Non-authoritative AI reasoning: hypotheses, rationale, uncertainty and validation plans. Never FOIL Core Truth and never merged with FOIL_CORE; only records that declare NON_AUTHORITATIVE_AI_REASONING are shown.",
		scope: "FOIL",
		routeId: "ai-reasoning",
		readOnly: true,
		presentation: "table",
		refreshPolicy: { mode: "ttl", ttlSeconds: 300 },
		steps: [
			{
				id: "reasoning",
				sourceId: "FOIL_AI_REASONING",
				authority: "FOIL AI Reasoning (non-authoritative)",
				collection: "reasoning",
				operation: "aggregate",
				pipeline: [
					{ $match: { authorityBoundary: "NON_AUTHORITATIVE_AI_REASONING" } },
					{ $sort: { updatedAt: -1 } },
					{
						$project: {
							title: "$topic",
							summary: "$objective",
							kind: 1,
							technology: 1,
							status: 1,
							authorityBoundary: 1,
							promotionState: "$promotion.currentState",
							automaticPromotion: "$promotion.automatic",
							backlogRefs: 1,
							projectRefs: 1,
							updatedAt: 1,
						},
					},
				],
				limit: 50,
				label: "Recent reasoning records (hypotheses, not truth)",
			},
			{
				id: "boundary",
				sourceId: "FOIL_AI_REASONING",
				authority: "FOIL AI Reasoning (non-authoritative)",
				collection: "registry",
				operation: "aggregate",
				pipeline: [
					{
						$project: {
							name: 1,
							summary: "$purpose",
							status: 1,
							coreTruthAuthority: 1,
							promotionRule: 1,
							useWhen: 1,
							doNotUseWhen: 1,
							updatedAt: 1,
						},
					},
				],
				limit: 10,
				optional: true,
				label: "Authority boundary and promotion rule",
			},
		],
		tags: ["foil", "ai-reasoning", "non-authoritative"],
	},
	{
		id: "FOIL_IT_DEV_STATUS",
		title: "FOIL IT DEV status",
		description:
			"Current software, cloud and data architecture decisions, contracts and architecture views from FOIL IT DEV. Superseded, cancelled and historical records are excluded.",
		scope: "FOIL",
		routeId: "it-dev",
		readOnly: true,
		presentation: "table",
		refreshPolicy: { mode: "ttl", ttlSeconds: 300 },
		steps: [
			{
				id: "decisions",
				sourceId: "FOIL_IT_DEV",
				authority: "FOIL IT DEV",
				collection: "decisions",
				operation: "aggregate",
				pipeline: [
					{ $match: CURRENT_RECORDS },
					{ $sort: { updatedAt: -1 } },
					{
						$project: {
							title: 1,
							summary: "$decision",
							status: 1,
							decidedAt: 1,
							projectRef: 1,
							architectureRef: 1,
							repository: 1,
							reasoningRef: 1,
							updatedAt: 1,
						},
					},
				],
				limit: 50,
				label: "Current architecture decisions",
			},
			{
				id: "contracts",
				sourceId: "FOIL_IT_DEV",
				authority: "FOIL IT DEV",
				collection: "contracts",
				operation: "aggregate",
				pipeline: [
					{ $match: CURRENT_RECORDS },
					{ $sort: { updatedAt: -1 } },
					{
						$project: {
							name: { $ifNull: ["$name", "$_id"] },
							summary: "$contract",
							status: 1,
							from: 1,
							to: 1,
							implementationStatus: 1,
							updatedAt: 1,
						},
					},
				],
				limit: 50,
				label: "Current integration contracts",
			},
			{
				id: "architecture-views",
				sourceId: "FOIL_IT_DEV",
				authority: "FOIL IT DEV",
				collection: "architecture_views",
				operation: "aggregate",
				pipeline: [
					{ $match: CURRENT_RECORDS },
					{ $sort: { updatedAt: -1 } },
					{
						$project: {
							name: 1,
							summary: { $ifNull: ["$summary", "$purpose"] },
							status: 1,
							deploymentStatus: 1,
							nextAction: 1,
							implementationRepo: 1,
							implementationHead: 1,
							updatedAt: 1,
						},
					},
				],
				limit: 50,
				label: "Current architecture views",
			},
		],
		tags: ["foil", "it-dev", "architecture"],
	},
	{
		id: "FOIL_FRONT_STATUS",
		title: "FOIL FRONT status",
		description:
			"Front-end application registry, current UX decisions and the current visual specifications and versions from FOIL FRONT. Superseded, cancelled and historical visual records are excluded.",
		scope: "FOIL",
		routeId: "front",
		readOnly: true,
		presentation: "table",
		refreshPolicy: { mode: "ttl", ttlSeconds: 300 },
		steps: [
			{
				id: "apps",
				sourceId: "FOIL_FRONT",
				authority: "FOIL FRONT",
				collection: "front_registry",
				operation: "aggregate",
				pipeline: [
					{ $sort: { priority: 1, name: 1 } },
					{
						$project: {
							name: { $ifNull: ["$name", "$_id"] },
							summary: "$role",
							type: 1,
							status: 1,
							priority: 1,
							repository: 1,
							deploymentStatus: 1,
							nextAction: 1,
							updatedAt: 1,
						},
					},
				],
				limit: 50,
				label: "Front-end applications and surfaces",
			},
			{
				id: "decisions",
				sourceId: "FOIL_FRONT",
				authority: "FOIL FRONT",
				collection: "decisions",
				operation: "aggregate",
				pipeline: [
					{ $match: CURRENT_RECORDS },
					{ $sort: { updatedAt: -1 } },
					{
						$project: {
							title: 1,
							summary: "$decision",
							status: 1,
							projectRef: 1,
							architectureRef: 1,
							updatedAt: 1,
						},
					},
				],
				limit: 50,
				label: "Current UX / front decisions",
			},
			{
				id: "visual-specs",
				sourceId: "FOIL_FRONT",
				authority: "FOIL FRONT",
				collection: "visual_specs",
				operation: "aggregate",
				pipeline: [
					{ $match: CURRENT_RECORDS },
					{ $sort: { updatedAt: -1 } },
					{
						$project: {
							name: 1,
							summary: { $ifNull: ["$purpose", "$technology"] },
							status: 1,
							technology: 1,
							approvalState: 1,
							machineRef: 1,
							currentVersionRef: 1,
							nextAction: 1,
							updatedAt: 1,
						},
					},
				],
				limit: 30,
				label: "Current visual specifications",
			},
			{
				id: "visual-versions",
				sourceId: "FOIL_FRONT",
				authority: "FOIL FRONT",
				collection: "visual_versions",
				operation: "aggregate",
				pipeline: [
					{ $match: CURRENT_RECORDS },
					{ $sort: { createdAt: -1 } },
					{
						$project: {
							name: { $ifNull: ["$versionLabel", "$_id"] },
							summary: { $ifNull: ["$summary", { $ifNull: ["$decisionSummary", "$decision"] }] },
							recordType: 1,
							status: 1,
							familyId: 1,
							visualSpecRef: 1,
							version: 1,
							nextAction: 1,
							createdAt: 1,
							updatedAt: 1,
						},
					},
				],
				limit: 30,
				optional: true,
				label: "Current visual versions and decisions",
			},
		],
		tags: ["foil", "front", "visual"],
	},
	{
		id: "FOIL_DATABRICKS_STATUS",
		title: "FOIL Databricks lab status",
		description:
			"Databricks lab control metadata from foil_lab: work items, campaigns, studies, model profiles, machine contracts and lab metadata. Runtime, Gold tables and MLflow remain Databricks runtime authorities; nothing here is measured evidence.",
		scope: "FOIL",
		routeId: "databricks",
		readOnly: true,
		presentation: "table",
		refreshPolicy: { mode: "ttl", ttlSeconds: 300 },
		steps: [
			{
				id: "work-items",
				sourceId: "FOIL_DATABRICKS",
				authority: "FOIL Databricks Lab",
				collection: "work_items",
				operation: "aggregate",
				pipeline: [
					{ $sort: { createdAt: -1 } },
					{
						$project: {
							title: 1,
							summary: { $ifNull: ["$note", "$currentStep"] },
							type: 1,
							priority: 1,
							status: 1,
							currentStep: 1,
							relatedStudyId: 1,
							relatedCampaignId: 1,
							relatedModelId: 1,
							completedAt: 1,
							createdAt: 1,
							updatedAt: 1,
						},
					},
				],
				limit: 100,
				label: "Lab work items",
			},
			{
				id: "campaigns",
				sourceId: "FOIL_DATABRICKS",
				authority: "FOIL Databricks Lab",
				collection: "campaigns",
				operation: "aggregate",
				pipeline: [
					{ $sort: { updatedAt: -1 } },
					{
						$project: {
							name: { $ifNull: ["$campaignId", "$_id"] },
							summary: "$objective",
							status: 1,
							studyId: 1,
							technology: 1,
							classification: 1,
							expectedScenarioCount: 1,
							updatedAt: 1,
						},
					},
				],
				limit: 50,
				label: "Campaigns",
			},
			{
				id: "studies",
				sourceId: "FOIL_DATABRICKS",
				authority: "FOIL Databricks Lab",
				collection: "studies",
				operation: "aggregate",
				pipeline: [
					{ $sort: { updatedAt: -1 } },
					{
						$project: {
							title: 1,
							summary: "$objective",
							studyId: 1,
							status: 1,
							priority: 1,
							technology: 1,
							campaignIds: 1,
							updatedAt: 1,
						},
					},
				],
				limit: 50,
				optional: true,
				label: "Lab studies",
			},
			{
				id: "model-profiles",
				sourceId: "FOIL_DATABRICKS",
				authority: "FOIL Databricks Lab",
				collection: "model_profiles",
				operation: "aggregate",
				pipeline: [
					{ $sort: { updatedAt: -1 } },
					{
						$project: {
							name: { $ifNull: ["$modelId", "$_id"] },
							summary: "$purpose",
							status: 1,
							version: 1,
							maturityLevel: 1,
							machineId: 1,
							machineRevision: 1,
							classification: 1,
							limitations: 1,
							updatedAt: 1,
						},
					},
				],
				limit: 50,
				label: "Model profiles",
			},
			{
				id: "machine-contracts",
				sourceId: "FOIL_DATABRICKS",
				authority: "FOIL Databricks Lab",
				collection: "machine_contracts",
				operation: "aggregate",
				pipeline: [
					{ $sort: { createdAt: -1 } },
					{
						$project: {
							name: { $ifNull: ["$machineId", "$_id"] },
							summary: "$classification",
							status: 1,
							revision: 1,
							technology: 1,
							factCount: { $size: { $ifNull: ["$facts", []] } },
							unknownCount: { $size: { $ifNull: ["$unknowns", []] } },
							createdAt: 1,
						},
					},
				],
				limit: 50,
				label: "Machine contracts (lab copies of Core Truth contracts)",
			},
			{
				id: "lab-meta",
				sourceId: "FOIL_DATABRICKS",
				authority: "FOIL Databricks Lab",
				collection: "lab_meta",
				operation: "aggregate",
				pipeline: [
					{ $sort: { _id: 1 } },
					{
						$project: {
							name: { $ifNull: ["$name", "$_id"] },
							summary: { $ifNull: ["$purpose", "$name"] },
							status: 1,
							activeTechnology: 1,
							updatedAt: 1,
						},
					},
				],
				limit: 20,
				optional: true,
				label: "Lab metadata and policies",
			},
		],
		tags: ["foil", "databricks", "lab"],
	},
	{
		id: "FOIL_FABRIC_STATUS",
		title: "FOIL Fabric lab status",
		description:
			"Setup-stage Fabric control metadata from foil_fabric_lab (lab_meta only). Fabric workspace and code repository are not registered yet, so no live Fabric deployment is claimed.",
		scope: "FOIL",
		routeId: "fabric",
		readOnly: true,
		presentation: "table",
		refreshPolicy: { mode: "ttl", ttlSeconds: 300 },
		steps: [
			{
				id: "lab-meta",
				sourceId: "FOIL_FABRIC",
				authority: "FOIL Ms Fabric",
				collection: "lab_meta",
				operation: "aggregate",
				pipeline: [
					{ $sort: { _id: 1 } },
					{
						$project: {
							name: { $ifNull: ["$name", "$_id"] },
							summary: { $ifNull: ["$purpose", { $ifNull: ["$codeRule", "$name"] }] },
							status: 1,
							authorityFor: 1,
							notAuthorityFor: 1,
							plannedCapabilities: 1,
							currentGaps: 1,
							workspaceIdentity: "$workspace.identity",
							sourceRepository: "$sourceControl.repository",
							updatedAt: 1,
						},
					},
				],
				limit: 20,
				label: "Fabric lab metadata, boundaries and gaps",
			},
		],
		tags: ["foil", "fabric", "lab"],
	},
	{
		id: "SOURCE_INVENTORY",
		title: "Source inventory",
		description:
			"One section per catalog source: whether it resolves (binding and FOIL PM registry) and its collections with estimated counts. Metadata only; no documents are read.",
		scope: "GLOBAL",
		routeId: "source-inventory",
		readOnly: true,
		presentation: "resources",
		refreshPolicy: { mode: "ttl", ttlSeconds: 300 },
		// Generated from the catalog so every source added later is exercised through the report engine.
		steps: sourceCatalog.map((source) => ({
			id: source.id.toLowerCase(),
			sourceId: source.id,
			authority: source.authority,
			collection: "*",
			operation: "inventory" as const,
			limit: 100,
			optional: true,
			label: source.authority + " (" + (source.database ?? source.id) + ")",
		})),
		tags: ["global", "sources", "inventory", "federation"],
	},
	{
		id: "MAINTENANCE",
		title: "Portfolio maintenance",
		description:
			"What needs attention, from recorded metadata only: source reachability, project verification freshness, recorded heads, Galaxy projections, audit runs and reconciliation findings. Each row names the smallest next action; nothing is executed. Backups are not recorded in any bound source, so none are claimed.",
		scope: "GLOBAL",
		routeId: "galaxy-maintenance",
		readOnly: true,
		presentation: "status",
		refreshPolicy: { mode: "ttl", ttlSeconds: 300 },
		// The server derives the published sections from these raw steps (src/lib/datapass/maintenance.ts).
		steps: [
			...sourceCatalog.map((source) => ({
				id: "probe-" + source.id.toLowerCase(),
				sourceId: source.id,
				authority: source.authority,
				collection: "*",
				operation: "inventory" as const,
				limit: 100,
				optional: true,
				label: source.authority + " (" + (source.database ?? source.id) + ")",
			})),
			{
				id: "organizations",
				sourceId: "DATAPROJECTS_GLOBAL",
				authority: "DATAPASSCONTROL",
				collection: "organizations",
				operation: "find",
				filter: {},
				projection: { _id: 0, organization_id: 1, name: 1, default_project_id: 1 },
				limit: 50,
				optional: true,
				label: "Organizations",
			},
			{
				id: "entities",
				sourceId: "DATAPROJECTS_GLOBAL",
				authority: "DATAPASSCONTROL",
				collection: "entities",
				operation: "find",
				filter: {},
				projection: {
					_id: 0,
					entity_id: 1,
					name: 1,
					entity_type: 1,
					organization_id: 1,
					parent_entity_id: 1,
					alias_of: 1,
					status: 1,
					lifecycle: 1,
					test_readiness: 1,
					updated_at: 1,
					last_verified_at: 1,
					canonical_repo: 1,
					current_head: 1,
					current_repo_head: 1,
					code_head: 1,
					"ci_evidence.head": 1,
					"ci_evidence.result": 1,
					mongoku_projection: 1,
				},
				sort: { entity_id: 1 },
				limit: 250,
				optional: true,
				label: "Entities",
			},
			{
				id: "repositories",
				sourceId: "DATAPROJECTS_GLOBAL",
				authority: "DATAPASSCONTROL",
				collection: "repositories",
				operation: "find",
				filter: {},
				projection: { _id: 0, repo: 1, entity_id: 1, last_reviewed: 1, active_head: 1 },
				limit: 500,
				optional: true,
				label: "Repositories",
			},
			{
				id: "work",
				sourceId: "DATAPROJECTS_GLOBAL",
				authority: "DATAPASSCONTROL",
				collection: "work_items",
				operation: "find",
				filter: { status: { $nin: ["done", "DONE", "closed", "CLOSED"] } },
				projection: { _id: 0, work_item_id: 1, project_id: 1, kind: 1, status: 1, observed_at: 1 },
				limit: 200,
				optional: true,
				label: "Open work",
			},
			{
				id: "audits",
				sourceId: "DATAPROJECTS_GLOBAL",
				authority: "DATAPASSCONTROL",
				collection: "audit_runs",
				operation: "aggregate",
				pipeline: [
					{ $sort: { completed_at: -1 } },
					{
						$project: {
							_id: 0,
							audit_id: 1,
							audit_type: 1,
							completed_at: 1,
							status: 1,
							nextActions: { $cond: [{ $isArray: "$next_actions" }, { $size: "$next_actions" }, 0] },
							limitations: { $cond: [{ $isArray: "$limitations" }, { $size: "$limitations" }, 0] },
						},
					},
				],
				limit: 20,
				optional: true,
				label: "Audit runs",
			},
		],
		tags: ["global", "maintenance", "freshness", "galaxy"],
	},
];

export function getSourceDescriptor(sourceId: string): SourceDescriptor | undefined {
	return sourceCatalog.find((source) => source.id === sourceId);
}

export function getReportDefinition(reportId: string): ReportDefinition | undefined {
	return reportCatalog.find((report) => report.id === reportId);
}
