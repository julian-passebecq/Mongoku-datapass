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
	{ id: "datapass-studio", name: "Datapass Studio", summary: "Unified data-engineering learning workspace and VS Code tooling.", status: "active", category: "Data engineering", progress: 72, activeItems: 9 },
	{ id: "powertoy", name: "PowerToy", summary: "Compact desktop cockpit for projects, services and daily actions.", status: "active", category: "Desktop tooling", progress: 58, activeItems: 6 },
	{ id: "foil", name: "FOIL", summary: "Wind-energy simulation, telemetry and analytics platform.", status: "active", category: "IoT / Data platform", progress: 46, activeItems: 8 },
	{ id: "contoso", name: "Contoso Data Studio", summary: "DuckLake, dbt and lightweight analytics laboratory.", status: "active", category: "Analytics lab", progress: 64, activeItems: 5 }
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
