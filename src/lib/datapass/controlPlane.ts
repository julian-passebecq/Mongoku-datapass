export type ProjectStatus = "active" | "paused" | "done";
export type WorkStatus = "backlog" | "todo" | "in_progress" | "blocked" | "done";
export type WorkType = "task" | "bug" | "idea" | "note" | "research" | "milestone" | "decision";
export type QueryOperation = "find" | "aggregate";
export type ControlResourceType =
	| "project"
	| "workItem"
	| "agentNode"
	| "instructionProfile"
	| "savedQuery"
	| "workspacePreset"
	| "systemNode"
	| "systemEdge";

export type ControlChangeOperation = {
	id: string;
	kind: "upsert" | "delete";
	resourceType: ControlResourceType;
	resourceId: string;
	value?: Record<string, unknown>;
	rationale?: string;
};

export type ControlChangeSet = {
	schemaVersion: 1;
	id: string;
	source: string;
	summary: string;
	createdAt: string;
	baseRevision: number;
	baseFingerprint: string;
	operations: ControlChangeOperation[];
};

export type Project = {
	id: string;
	name: string;
	summary: string;
	status: ProjectStatus;
	parentProjectId?: string;
	category: string;
	progress: number;
	activeItems: number;
	kanbanStatus: WorkStatus;
	statusQueryId?: string;
	tags: string[];
	githubRepo?: string;
	mongoContextKey?: string;
	mongoNamespaces?: string[];
};

export type WorkItem = {
	id: string;
	projectId: string;
	title: string;
	status: WorkStatus;
	type: WorkType;
	priority: "low" | "medium" | "high";
	dueDate?: string;
	createdAt?: string;
	tags: string[];
};

export type InstructionProfile = {
	id: string;
	projectId: string;
	name: string;
	version: number;
	summary: string;
	body: string;
	tags: string[];
};

export type AgentNode = {
	id: string;
	projectId: string;
	label: string;
	role: string;
	parentId?: string;
	responsibilities: string[];
	mongoScope: string[];
	tags: string[];
	instructionProfileId?: string;
	githubRepo?: string;
};

export type SavedMongoQuery = {
	id: string;
	name: string;
	description: string;
	collection: string;
	operation: QueryOperation;
	filter?: Record<string, unknown>;
	pipeline?: Record<string, unknown>[];
	sort?: Record<string, 1 | -1>;
	limit?: number;
	parameters: { name: string; type: "string" | "string[]"; source?: "project" | "project-tree" | "manual" }[];
	presentation: "project-board" | "status-summary" | "table" | "count" | "calendar" | "notes" | "detail" | "dashboard";
	readOnly: true;
	tags: string[];
};

export type WorkspacePreset = {
	id: string;
	name: string;
	description: string;
	defaultProjectId?: string;
	tabs: { id: string; title: string; href: string; projectId?: string }[];
	bookmarks: { id: string; title: string; href: string }[];
	leftPanelCollapsed: boolean;
	rightPanelOpen: boolean;
	rightPanelMode: "context" | "bookmarks" | "queries" | "settings";
	tags: string[];
};

export type SystemNode = {
	id: string;
	label: string;
	kind: "source" | "runtime" | "stream" | "database" | "analytics";
	state: "healthy" | "warning" | "offline";
	detail: string;
};

export type SystemEdge = {
	from: string;
	to: string;
	label: string;
};

export const projects: Project[] = [
	{ id: "datapass-studio", name: "Datapass Studio", summary: "Unified data-engineering learning workspace and VS Code tooling.", status: "active", category: "Data engineering", progress: 72, activeItems: 9, kanbanStatus: "in_progress", statusQueryId: "project-work-status-summary", tags: ["learning", "vscode", "data-engineering"], githubRepo: "julian-passebecq/datapass-mosaic-vscode", mongoContextKey: "datapass", mongoNamespaces: ["datapass.projects", "datapass.work_items", "datapass.agent_context"] },
	{ id: "datapass-mosaic", name: "Mosaic", summary: "Notebook and workspace experience.", status: "active", parentProjectId: "datapass-studio", category: "Workspace", progress: 68, activeItems: 3, kanbanStatus: "in_progress", statusQueryId: "project-work-status-summary", tags: ["notebook", "mosaic"] },
	{ id: "datapass-sparklab", name: "SparkLab", summary: "Local-first Spark learning kernel.", status: "active", parentProjectId: "datapass-studio", category: "Runtime", progress: 61, activeItems: 2, kanbanStatus: "todo", statusQueryId: "project-work-status-summary", tags: ["spark", "pyspark"] },
	{ id: "datapass-dbt", name: "dbt Lab", summary: "dbt transformations, lineage and exercises.", status: "active", parentProjectId: "datapass-studio", category: "Transformation", progress: 54, activeItems: 2, kanbanStatus: "todo", statusQueryId: "project-work-status-summary", tags: ["dbt", "lineage"] },
	{ id: "powertoy", name: "PowerToy", summary: "Compact desktop cockpit for projects, services and daily actions.", status: "active", category: "Desktop tooling", progress: 58, activeItems: 6, kanbanStatus: "in_progress", statusQueryId: "project-work-status-summary", tags: ["desktop", "control-plane"], mongoContextKey: "powertoy", mongoNamespaces: ["powertoy.projects", "powertoy.work_items"] },
	{ id: "foil", name: "FOIL", summary: "Wind-energy simulation, telemetry and analytics platform.", status: "active", category: "IoT / Data platform", progress: 46, activeItems: 8, kanbanStatus: "in_progress", statusQueryId: "project-work-status-summary", tags: ["wind", "iot", "streaming"], githubRepo: "julian-passebecq/foil", mongoContextKey: "foil", mongoNamespaces: ["foil.projects", "foil.telemetry", "foil.alerts", "foil.agent_context"] },
	{ id: "foil-runtime", name: "Runtime", summary: "Oracle VM and simulation services.", status: "active", parentProjectId: "foil", category: "Runtime", progress: 42, activeItems: 2, kanbanStatus: "in_progress", statusQueryId: "project-work-status-summary", tags: ["oracle-vm", "simulation"] },
	{ id: "foil-stream", name: "Streaming", summary: "Kafka and realtime event movement.", status: "active", parentProjectId: "foil", category: "Streaming", progress: 39, activeItems: 2, kanbanStatus: "todo", statusQueryId: "project-work-status-summary", tags: ["kafka", "events"] },
	{ id: "foil-data", name: "Data Platform", summary: "MongoDB, Fabric and Databricks integration.", status: "active", parentProjectId: "foil", category: "Data", progress: 48, activeItems: 4, kanbanStatus: "in_progress", statusQueryId: "project-work-status-summary", tags: ["mongodb", "fabric", "databricks"] },
	{ id: "contoso", name: "Contoso Data Studio", summary: "DuckLake, dbt and lightweight analytics laboratory.", status: "active", category: "Analytics lab", progress: 64, activeItems: 5, kanbanStatus: "blocked", statusQueryId: "project-work-status-summary", tags: ["ducklake", "dbt", "contoso"], githubRepo: "julian-passebecq/contoso-data-studio", mongoContextKey: "contoso", mongoNamespaces: ["contoso.projects", "contoso.datasets", "contoso.work_items"] }
];

export const workItems: WorkItem[] = [
	{ id: "w-001", projectId: "datapass-studio", title: "Connect Mosaic workspace to the shared execution model", status: "in_progress", type: "task", priority: "high", dueDate: "2026-09-25", createdAt: "2026-09-22", tags: ["mosaic", "runtime"] },
	{ id: "w-002", projectId: "datapass-studio", title: "Add dbt lineage learning view", status: "todo", type: "task", priority: "medium", dueDate: "2026-09-29", createdAt: "2026-09-22", tags: ["dbt", "lineage"] },
	{ id: "w-003", projectId: "powertoy", title: "Add lightweight project snapshot pane", status: "todo", type: "task", priority: "medium", dueDate: "2026-09-27", createdAt: "2026-09-23", tags: ["desktop", "projects"] },
	{ id: "w-004", projectId: "foil", title: "Expose Mongo replica-set health in FOIL control view", status: "in_progress", type: "task", priority: "high", dueDate: "2026-09-24", createdAt: "2026-09-23", tags: ["mongodb", "topology"] },
	{ id: "w-005", projectId: "foil", title: "Map turbine telemetry path from source to analytics", status: "backlog", type: "research", priority: "medium", createdAt: "2026-09-23", tags: ["kafka", "fabric", "databricks"] },
	{ id: "w-006", projectId: "contoso", title: "Create guided bronze-to-gold sample project", status: "blocked", type: "milestone", priority: "high", dueDate: "2026-09-26", createdAt: "2026-09-22", tags: ["ducklake", "dbt"] },
	{ id: "w-007", projectId: "datapass-studio", title: "Document VS Code extension module boundaries", status: "done", type: "decision", priority: "medium", createdAt: "2026-09-21", tags: ["vscode", "architecture"] },
	{ id: "w-008", projectId: "foil", title: "Leader routes Mongo-specific work to the Data branch before implementation", status: "todo", type: "note", priority: "low", createdAt: "2026-09-23", tags: ["ai", "leader", "mongodb"] },
	{ id: "w-009", projectId: "powertoy", title: "PowerToy remains a compact launcher; full project management stays in Mongo Control", status: "todo", type: "decision", priority: "low", createdAt: "2026-09-23", tags: ["powertoy", "architecture"] }
];

export const instructionProfiles: InstructionProfile[] = [
	{ id: "foil-lead-v1", projectId: "foil", name: "FOIL Lead", version: 1, summary: "Coordinates architecture, ownership and delegation across FOIL.", body: "Own the FOIL system map, route work to the correct specialist, preserve project boundaries, and keep decisions linked to the relevant Mongo project context.", tags: ["leader", "architecture", "delegation"] },
	{ id: "foil-code-v1", projectId: "foil", name: "FOIL Coding", version: 1, summary: "Implements application and integration code.", body: "Focus on implementation, tests and integration boundaries. Read architecture context before changing runtime or data contracts.", tags: ["code", "tests", "integration"] },
	{ id: "foil-data-v1", projectId: "foil", name: "FOIL Data", version: 1, summary: "Owns MongoDB, Kafka and analytics data contracts.", body: "Maintain collection semantics, data-flow ownership and compatibility across MongoDB, Kafka, Fabric and Databricks.", tags: ["mongodb", "kafka", "data"] },
	{ id: "foil-ops-v1", projectId: "foil", name: "FOIL Ops", version: 1, summary: "Owns runtime health and operational visibility.", body: "Track Oracle VM, services, health signals and Grafana-facing operational state. Prefer observable and reversible changes.", tags: ["ops", "oracle-vm", "grafana"] }
];

export const agentNodes: AgentNode[] = [
	{ id: "foil-leader", projectId: "foil", label: "FOIL Leader", role: "Project leader", responsibilities: ["architecture", "delegation", "decision routing"], mongoScope: ["foil.projects", "foil.decisions", "foil.agent_context"], tags: ["leader", "architecture"], instructionProfileId: "foil-lead-v1" },
	{ id: "foil-code", projectId: "foil", label: "Code", role: "Implementation agent", parentId: "foil-leader", responsibilities: ["application code", "tests", "integration"], mongoScope: ["foil.tasks", "foil.code_context"], tags: ["code", "tests"], instructionProfileId: "foil-code-v1", githubRepo: "julian-passebecq/foil" },
	{ id: "foil-data-agent", projectId: "foil", label: "Data", role: "Data-platform agent", parentId: "foil-leader", responsibilities: ["MongoDB", "Kafka", "analytics contracts"], mongoScope: ["foil.telemetry", "foil.alerts", "foil.simulations"], tags: ["mongodb", "kafka", "data"], instructionProfileId: "foil-data-v1" },
	{ id: "foil-ops", projectId: "foil", label: "Ops", role: "Runtime operations agent", parentId: "foil-leader", responsibilities: ["Oracle VM", "health", "Grafana"], mongoScope: ["foil.runtime_state", "foil.ops_events"], tags: ["ops", "grafana"], instructionProfileId: "foil-ops-v1" },
	{ id: "foil-backend", projectId: "foil", label: "Backend", role: "Backend specialist", parentId: "foil-code", responsibilities: ["APIs", "services", "connectors"], mongoScope: ["foil.service_config"], tags: ["backend", "api"] },
	{ id: "foil-ui", projectId: "foil", label: "UI", role: "Frontend specialist", parentId: "foil-code", responsibilities: ["control UI", "visualization"], mongoScope: ["foil.ui_state"], tags: ["ui", "visualization"] },
	{ id: "foil-mongo", projectId: "foil", label: "Mongo Model", role: "MongoDB specialist", parentId: "foil-data-agent", responsibilities: ["collections", "indexes", "relationships"], mongoScope: ["foil.*"], tags: ["mongodb", "schema"] },
	{ id: "foil-streaming", projectId: "foil", label: "Streaming", role: "Kafka specialist", parentId: "foil-data-agent", responsibilities: ["topics", "consumers", "event contracts"], mongoScope: ["foil.stream_contracts"], tags: ["kafka", "streaming"] },
	{ id: "foil-analytics", projectId: "foil", label: "Analytics", role: "Fabric / Databricks specialist", parentId: "foil-data-agent", responsibilities: ["realtime analytics", "engineering", "ML"], mongoScope: ["foil.analytics_context"], tags: ["fabric", "databricks"] },
	{ id: "foil-runtime-agent", projectId: "foil", label: "Runtime", role: "VM specialist", parentId: "foil-ops", responsibilities: ["Oracle VM", "process health"], mongoScope: ["foil.runtime_state"], tags: ["oracle-vm", "runtime"] }
];


export const savedQueries: SavedMongoQuery[] = [
	{
		id: "project-portfolio-board",
		name: "Project portfolio board",
		description: "Returns project and subproject records for the portfolio Kanban. The UI groups results by kanbanStatus.",
		collection: "projects",
		operation: "find",
		filter: { status: { $ne: "done" } },
		sort: { name: 1 },
		parameters: [],
		presentation: "project-board",
		readOnly: true,
		tags: ["projects", "kanban", "portfolio"]
	},
	{
		id: "project-work-status-summary",
		name: "Project work status summary",
		description: "Counts work items by status for a selected project and all selected child project ids.",
		collection: "work_items",
		operation: "aggregate",
		pipeline: [
			{ $match: { projectId: { $in: "{{projectIds}}" } } },
			{ $group: { _id: "$status", count: { $sum: 1 } } },
			{ $sort: { _id: 1 } }
		],
		parameters: [{ name: "projectIds", type: "string[]", source: "project-tree" }],
		presentation: "status-summary",
		readOnly: true,
		tags: ["projects", "status", "work-items"]
	},
	{
		id: "project-open-work",
		name: "Open work by project",
		description: "Returns non-done work items for one project scope.",
		collection: "work_items",
		operation: "find",
		filter: { projectId: { $in: "{{projectIds}}" }, status: { $ne: "done" } },
		sort: { priority: -1 },
		parameters: [{ name: "projectIds", type: "string[]", source: "project-tree" }],
		presentation: "table",
		readOnly: true,
		tags: ["projects", "work-items"]
	},
	{
		id: "calendar-upcoming",
		name: "Upcoming calendar items",
		description: "Returns open work items that have a due date. Used by the general and project calendar.",
		collection: "work_items",
		operation: "find",
		filter: { status: { $ne: "done" }, dueDate: { $exists: true } },
		sort: { dueDate: 1 },
		parameters: [],
		presentation: "calendar",
		readOnly: true,
		tags: ["calendar", "dashboard", "work-items"]
	},
	{
		id: "project-calendar",
		name: "Project calendar",
		description: "Returns dated work items for one project tree.",
		collection: "work_items",
		operation: "find",
		filter: { projectId: { $in: "{{projectIds}}" }, status: { $ne: "done" }, dueDate: { $exists: true } },
		sort: { dueDate: 1 },
		parameters: [{ name: "projectIds", type: "string[]", source: "project-tree" }],
		presentation: "calendar",
		readOnly: true,
		tags: ["calendar", "projects"]
	},
	{
		id: "notes-recent",
		name: "Notes and decisions",
		description: "Returns note, decision and research items across the workspace.",
		collection: "work_items",
		operation: "find",
		filter: { type: { $in: ["note", "decision", "research"] } },
		sort: { createdAt: -1 },
		parameters: [],
		presentation: "notes",
		readOnly: true,
		tags: ["notes", "decisions", "dashboard"]
	},
	{
		id: "project-notes",
		name: "Project notes",
		description: "Returns note, decision and research items for a selected project tree.",
		collection: "work_items",
		operation: "find",
		filter: { projectId: { $in: "{{projectIds}}" }, type: { $in: ["note", "decision", "research"] } },
		sort: { createdAt: -1 },
		parameters: [{ name: "projectIds", type: "string[]", source: "project-tree" }],
		presentation: "notes",
		readOnly: true,
		tags: ["notes", "projects"]
	},
	{
		id: "project-detail",
		name: "Project detail",
		description: "Returns the project control document for a selected project id.",
		collection: "projects",
		operation: "find",
		filter: { id: "{{projectId}}" },
		limit: 1,
		parameters: [{ name: "projectId", type: "string", source: "project" }],
		presentation: "detail",
		readOnly: true,
		tags: ["projects", "detail", "inspector"]
	}
];


export const workspacePresets: WorkspacePreset[] = [
	{
		id: "project-manager",
		name: "Project Manager",
		description: "General portfolio, calendar, notes and project-control workspace.",
		tabs: [
			{ id: "dashboard", title: "Dashboard", href: "/" },
			{ id: "projects", title: "Projects", href: "/projects" },
			{ id: "calendar", title: "Calendar", href: "/calendar" },
			{ id: "notes", title: "Notes", href: "/notes" }
		],
		bookmarks: [
			{ id: "ai-json", title: "AI JSON", href: "/ai-json" },
			{ id: "queries", title: "Queries", href: "/queries" }
		],
		leftPanelCollapsed: false,
		rightPanelOpen: true,
		rightPanelMode: "context",
		tags: ["projects", "daily"]
	},
	{
		id: "foil-command",
		name: "FOIL Command",
		description: "FOIL project, AI graph, tasks and system visibility.",
		defaultProjectId: "foil",
		tabs: [
			{ id: "foil", title: "FOIL", href: "/foil", projectId: "foil" },
			{ id: "foil-graph", title: "AI Graph", href: "/architecture?project=foil", projectId: "foil" },
			{ id: "foil-work", title: "Tasks", href: "/projects?project=foil", projectId: "foil" },
			{ id: "foil-calendar", title: "Calendar", href: "/calendar?project=foil", projectId: "foil" }
		],
		bookmarks: [
			{ id: "foil-github", title: "FOIL GitHub", href: "https://github.com/julian-passebecq/foil" },
			{ id: "mongo-explorer", title: "Mongo Explorer", href: "/servers" }
		],
		leftPanelCollapsed: false,
		rightPanelOpen: true,
		rightPanelMode: "context",
		tags: ["foil", "operations"]
	},
	{
		id: "mongo-focus",
		name: "Mongo Focus",
		description: "Lightweight Mongo exploration plus editable saved queries.",
		tabs: [
			{ id: "mongo", title: "Mongo Explorer", href: "/servers" },
			{ id: "queries", title: "Saved Queries", href: "/queries" },
			{ id: "ai-json", title: "AI JSON", href: "/ai-json" }
		],
		bookmarks: [],
		leftPanelCollapsed: true,
		rightPanelOpen: true,
		rightPanelMode: "queries",
		tags: ["mongodb", "queries"]
	}
];

export const foilNodes: SystemNode[] = [
	{ id: "turbine", label: "Wind Turbine", kind: "source", state: "healthy", detail: "Telemetry source" },
	{ id: "oracle", label: "Oracle VM", kind: "runtime", state: "healthy", detail: "Simulation host" },
	{ id: "kafka", label: "Kafka", kind: "stream", state: "healthy", detail: "Event stream" },
	{ id: "mongo", label: "MongoDB", kind: "database", state: "healthy", detail: "Operational store / replica set" },
	{ id: "grafana", label: "Grafana", kind: "analytics", state: "healthy", detail: "Operations dashboard" },
	{ id: "fabric", label: "Microsoft Fabric", kind: "analytics", state: "warning", detail: "Realtime / engineering lab" },
	{ id: "databricks", label: "Databricks", kind: "analytics", state: "healthy", detail: "Engineering and ML" }
];

export const foilEdges: SystemEdge[] = [
	{ from: "turbine", to: "oracle", label: "telemetry" },
	{ from: "oracle", to: "kafka", label: "events" },
	{ from: "kafka", to: "mongo", label: "stream ingest" },
	{ from: "mongo", to: "grafana", label: "operations" },
	{ from: "kafka", to: "fabric", label: "realtime" },
	{ from: "mongo", to: "databricks", label: "analytics" }
];

export const workStatuses: { id: WorkStatus; label: string }[] = [
	{ id: "backlog", label: "Backlog" },
	{ id: "todo", label: "Todo" },
	{ id: "in_progress", label: "In progress" },
	{ id: "blocked", label: "Blocked" },
	{ id: "done", label: "Done" }
];
