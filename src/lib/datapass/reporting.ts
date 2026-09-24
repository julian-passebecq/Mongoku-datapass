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

export type ReportQueryStep = {
	id: string;
	sourceId: string;
	authority: string;
	collection: string;
	operation: "find" | "aggregate";
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
	operation: "find" | "aggregate";
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
				filter: { project_id: "foil" },
				sort: { observed_at: -1 },
				limit: 100,
				label: "Global portfolio references",
			},
		],
		tags: ["foil", "global", "references"],
	},
];

export function getSourceDescriptor(sourceId: string): SourceDescriptor | undefined {
	return sourceCatalog.find((source) => source.id === sourceId);
}

export function getReportDefinition(reportId: string): ReportDefinition | undefined {
	return reportCatalog.find((report) => report.id === reportId);
}
