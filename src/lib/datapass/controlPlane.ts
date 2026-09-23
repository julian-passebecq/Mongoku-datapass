export type ProjectStatus = "active" | "paused" | "done";
export type WorkStatus = "backlog" | "todo" | "in_progress" | "blocked" | "done";
export type WorkType = "task" | "bug" | "idea" | "note" | "research" | "milestone" | "decision";

export type Project = {
	id: string;
	name: string;
	summary: string;
	status: ProjectStatus;
	parentProjectId?: string;
	category: string;
	progress: number;
	activeItems: number;
	tags: string[];
	githubRepo?: string;
};

export type WorkItem = {
	id: string;
	projectId: string;
	title: string;
	status: WorkStatus;
	type: WorkType;
	priority: "low" | "medium" | "high";
	dueDate?: string;
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
	{ id: "datapass-studio", name: "Datapass Studio", summary: "Unified data-engineering learning workspace and VS Code tooling.", status: "active", category: "Data engineering", progress: 72, activeItems: 9, tags: ["learning", "vscode", "data-engineering"], githubRepo: "julian-passebecq/datapass-mosaic-vscode" },
	{ id: "datapass-mosaic", name: "Mosaic", summary: "Notebook and workspace experience.", status: "active", parentProjectId: "datapass-studio", category: "Workspace", progress: 68, activeItems: 3, tags: ["notebook", "mosaic"] },
	{ id: "datapass-sparklab", name: "SparkLab", summary: "Local-first Spark learning kernel.", status: "active", parentProjectId: "datapass-studio", category: "Runtime", progress: 61, activeItems: 2, tags: ["spark", "pyspark"] },
	{ id: "datapass-dbt", name: "dbt Lab", summary: "dbt transformations, lineage and exercises.", status: "active", parentProjectId: "datapass-studio", category: "Transformation", progress: 54, activeItems: 2, tags: ["dbt", "lineage"] },
	{ id: "powertoy", name: "PowerToy", summary: "Compact desktop cockpit for projects, services and daily actions.", status: "active", category: "Desktop tooling", progress: 58, activeItems: 6, tags: ["desktop", "control-plane"] },
	{ id: "foil", name: "FOIL", summary: "Wind-energy simulation, telemetry and analytics platform.", status: "active", category: "IoT / Data platform", progress: 46, activeItems: 8, tags: ["wind", "iot", "streaming"], githubRepo: "julian-passebecq/foil" },
	{ id: "foil-runtime", name: "Runtime", summary: "Oracle VM and simulation services.", status: "active", parentProjectId: "foil", category: "Runtime", progress: 42, activeItems: 2, tags: ["oracle-vm", "simulation"] },
	{ id: "foil-stream", name: "Streaming", summary: "Kafka and realtime event movement.", status: "active", parentProjectId: "foil", category: "Streaming", progress: 39, activeItems: 2, tags: ["kafka", "events"] },
	{ id: "foil-data", name: "Data Platform", summary: "MongoDB, Fabric and Databricks integration.", status: "active", parentProjectId: "foil", category: "Data", progress: 48, activeItems: 4, tags: ["mongodb", "fabric", "databricks"] },
	{ id: "contoso", name: "Contoso Data Studio", summary: "DuckLake, dbt and lightweight analytics laboratory.", status: "active", category: "Analytics lab", progress: 64, activeItems: 5, tags: ["ducklake", "dbt", "contoso"], githubRepo: "julian-passebecq/contoso-data-studio" }
];

export const workItems: WorkItem[] = [
	{ id: "w-001", projectId: "datapass-studio", title: "Connect Mosaic workspace to the shared execution model", status: "in_progress", type: "task", priority: "high", tags: ["mosaic", "runtime"] },
	{ id: "w-002", projectId: "datapass-studio", title: "Add dbt lineage learning view", status: "todo", type: "task", priority: "medium", tags: ["dbt", "lineage"] },
	{ id: "w-003", projectId: "powertoy", title: "Add lightweight project snapshot pane", status: "todo", type: "task", priority: "medium", tags: ["desktop", "projects"] },
	{ id: "w-004", projectId: "foil", title: "Expose Mongo replica-set health in FOIL control view", status: "in_progress", type: "task", priority: "high", tags: ["mongodb", "topology"] },
	{ id: "w-005", projectId: "foil", title: "Map turbine telemetry path from source to analytics", status: "backlog", type: "research", priority: "medium", tags: ["kafka", "fabric", "databricks"] },
	{ id: "w-006", projectId: "contoso", title: "Create guided bronze-to-gold sample project", status: "blocked", type: "milestone", priority: "high", tags: ["ducklake", "dbt"] },
	{ id: "w-007", projectId: "datapass-studio", title: "Document VS Code extension module boundaries", status: "done", type: "decision", priority: "medium", tags: ["vscode", "architecture"] }
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
