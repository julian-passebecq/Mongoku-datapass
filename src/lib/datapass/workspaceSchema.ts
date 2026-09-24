import { z } from "zod";
import {
	agentNodes,
	foilEdges,
	foilNodes,
	instructionProfiles,
	projects,
	savedQueries,
	workspacePresets,
	workItems,
} from "./controlPlane";
import { reportCatalog, sourceCatalog } from "./reporting";

const workStatus = z.enum(["backlog", "todo", "in_progress", "blocked", "done"]);
const projectStatus = z.enum(["active", "paused", "done"]);

export const projectSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	summary: z.string(),
	status: projectStatus,
	parentProjectId: z.string().min(1).optional(),
	category: z.string(),
	progress: z.number().min(0).max(100),
	progressKnown: z.boolean().optional(),
	activeItems: z.number().int().min(0),
	kanbanStatus: workStatus,
	statusQueryId: z.string().min(1).optional(),
	tags: z.array(z.string()),
	githubRepo: z.string().optional(),
	mongoContextKey: z.string().optional(),
	mongoNamespaces: z.array(z.string()).optional(),
	rawStatus: z.string().optional(),
	rawEntityType: z.string().optional(),
	organizationId: z.string().optional(),
	parentEntityId: z.string().optional(),
	health: z.string().optional(),
	testReadiness: z.string().optional(),
	nextAction: z.string().optional(),
	canonicalRepo: z.string().optional(),
});

export const workItemSchema = z.object({
	id: z.string().min(1),
	projectId: z.string().min(1),
	title: z.string().min(1),
	status: workStatus,
	type: z.enum(["task", "bug", "idea", "note", "research", "milestone", "decision"]),
	priority: z.enum(["low", "medium", "high"]),
	dueDate: z.string().optional(),
	createdAt: z.string().optional(),
	tags: z.array(z.string()),
	classification: z.enum(["GLOBAL_PORTFOLIO_WORK", "FOIL_REFERENCE_MIRROR"]).optional(),
	externalAuthority: z.string().optional(),
	externalProjectRef: z.string().optional(),
	externalBacklogRef: z.string().optional(),
	rawStatus: z.string().optional(),
	rawKind: z.string().optional(),
	rawPriority: z.string().optional(),
	severity: z.string().optional(),
	nextAction: z.string().optional(),
});

export const instructionProfileSchema = z.object({
	id: z.string().min(1),
	projectId: z.string().min(1),
	name: z.string().min(1),
	version: z.number().int().positive(),
	summary: z.string(),
	body: z.string(),
	tags: z.array(z.string()),
});

export const agentNodeSchema = z.object({
	id: z.string().min(1),
	projectId: z.string().min(1),
	label: z.string().min(1),
	role: z.string().min(1),
	parentId: z.string().min(1).optional(),
	responsibilities: z.array(z.string()),
	mongoScope: z.array(z.string()),
	tags: z.array(z.string()),
	instructionProfileId: z.string().min(1).optional(),
	githubRepo: z.string().optional(),
});

const jsonRecord = z.record(z.string(), z.unknown());

export const savedMongoQuerySchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	description: z.string(),
	sourceId: z.string().optional(),
	authority: z.string().optional(),
	resourceRef: z.string().optional(),
	database: z.string().optional(),
	collection: z.string().min(1),
	operation: z.enum(["find", "aggregate"]),
	filter: jsonRecord.optional(),
	projection: jsonRecord.optional(),
	pipeline: z.array(jsonRecord).optional(),
	sort: z.record(z.string(), z.union([z.literal(1), z.literal(-1)])).optional(),
	limit: z.number().int().positive().max(10000).optional(),
	parameters: z.array(
		z.object({
			name: z.string().min(1),
			type: z.enum(["string", "string[]"]),
			source: z.enum(["project", "project-tree", "manual"]).optional(),
		}),
	),
	presentation: z.enum([
		"project-board",
		"status-summary",
		"table",
		"count",
		"calendar",
		"notes",
		"detail",
		"dashboard",
	]),
	readOnly: z.literal(true),
	routeId: z.string().optional(),
	resultSchema: jsonRecord.optional(),
	refreshPolicy: z
		.object({
			mode: z.enum(["manual", "on-open", "ttl"]),
			ttlSeconds: z.number().int().positive().optional(),
		})
		.optional(),
	tags: z.array(z.string()),
});

export const sourceDescriptorSchema = z.object({
	id: z.string().min(1),
	authority: z.string().min(1),
	provider: z.enum(["MONGODB_ATLAS", "GITHUB", "VERCEL", "DATABRICKS", "FABRIC", "OBJECT_STORAGE"]),
	adapter: z.literal("MONGODB"),
	resourceRef: z.string().min(1),
	database: z.string().optional(),
	readOnly: z.literal(true),
	defaultRoute: z.boolean(),
	description: z.string(),
	aliases: z.array(z.string()).optional(),
	registryAuthority: z.string().optional(),
});

const reportParameterSchema = z.object({
	name: z.string().min(1),
	type: z.enum(["string", "string[]", "date", "boolean"]),
	required: z.boolean().optional(),
});

const reportStepSchema = z.object({
	id: z.string().min(1),
	sourceId: z.string().min(1),
	authority: z.string().min(1),
	collection: z.string().min(1),
	operation: z.enum(["find", "aggregate"]),
	filter: jsonRecord.optional(),
	projection: jsonRecord.optional(),
	pipeline: z.array(jsonRecord).optional(),
	sort: z.record(z.string(), z.union([z.literal(1), z.literal(-1)])).optional(),
	limit: z.number().int().positive().max(5000).optional(),
	parameters: z.array(reportParameterSchema).optional(),
	optional: z.boolean().optional(),
	label: z.string().min(1),
});

export const reportDefinitionSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	description: z.string(),
	scope: z.enum(["GLOBAL", "FOIL"]),
	routeId: z.string().min(1),
	readOnly: z.literal(true),
	presentation: z.enum([
		"dashboard",
		"kanban",
		"table",
		"timeline",
		"calendar",
		"questions",
		"propagation",
		"resources",
		"documents",
		"architecture",
		"status",
	]),
	refreshPolicy: z.object({
		mode: z.enum(["manual", "on-open", "ttl"]),
		ttlSeconds: z.number().int().positive().optional(),
	}),
	parameters: z.array(reportParameterSchema).optional(),
	steps: z.array(reportStepSchema).min(1),
	tags: z.array(z.string()),
});

export const workspacePresetSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	description: z.string(),
	defaultProjectId: z.string().optional(),
	tabs: z.array(
		z.object({
			id: z.string().min(1),
			title: z.string().min(1),
			href: z.string().min(1),
			projectId: z.string().optional(),
		}),
	),
	bookmarks: z.array(
		z.object({
			id: z.string().min(1),
			title: z.string().min(1),
			href: z.string().min(1),
		}),
	),
	leftPanelCollapsed: z.boolean(),
	rightPanelOpen: z.boolean(),
	rightPanelMode: z.enum(["context", "bookmarks", "queries", "settings"]),
	tags: z.array(z.string()),
});

export const systemNodeSchema = z.object({
	id: z.string().min(1),
	label: z.string().min(1),
	kind: z.enum(["source", "runtime", "stream", "database", "analytics"]),
	state: z.enum(["healthy", "warning", "offline"]),
	detail: z.string(),
});

export const systemEdgeSchema = z.object({
	from: z.string().min(1),
	to: z.string().min(1),
	label: z.string(),
});

function duplicateIds(values: Array<{ id: string }>): string[] {
	const seen = new Set<string>();
	const duplicates = new Set<string>();
	for (const value of values) {
		if (seen.has(value.id)) {
			duplicates.add(value.id);
		}
		seen.add(value.id);
	}
	return Array.from(duplicates);
}

function findParentCycle(ids: string[], parentOf: (id: string) => string | undefined): string[] | null {
	const globallyDone = new Set<string>();

	for (const start of ids) {
		if (globallyDone.has(start)) {
			continue;
		}

		const path: string[] = [];
		const indexById = new Map<string, number>();
		let current: string | undefined = start;

		while (current) {
			if (indexById.has(current)) {
				const index = indexById.get(current)!;
				return [...path.slice(index), current];
			}
			if (globallyDone.has(current)) {
				break;
			}
			indexById.set(current, path.length);
			path.push(current);
			current = parentOf(current);
		}

		for (const id of path) {
			globallyDone.add(id);
		}
	}

	return null;
}

export const workspaceExportSchema = z
	.object({
		schemaVersion: z.literal(1),
		metadata: z.object({
			name: z.string(),
			source: z.enum(["seed", "mongo", "import"]),
			sourceMode: z
				.enum(["workspace-v1", "legacy-adapter", "seed-empty", "seed-disabled", "fallback-error"])
				.optional(),
			warning: z.string().optional(),
			exportedAt: z.string(),
			controlDatabase: z.string().optional(),
		}),
		projects: z.array(projectSchema),
		workItems: z.array(workItemSchema),
		agentNodes: z.array(agentNodeSchema),
		instructionProfiles: z.array(instructionProfileSchema),
		savedQueries: z.array(savedMongoQuerySchema),
		sources: z.array(sourceDescriptorSchema),
		reports: z.array(reportDefinitionSchema),
		workspacePresets: z.array(workspacePresetSchema),
		systemNodes: z.array(systemNodeSchema),
		systemEdges: z.array(systemEdgeSchema),
	})
	.superRefine((workspace, context) => {
		const uniqueGroups: Array<[string, Array<{ id: string }>]> = [
			["projects", workspace.projects],
			["workItems", workspace.workItems],
			["agentNodes", workspace.agentNodes],
			["instructionProfiles", workspace.instructionProfiles],
			["savedQueries", workspace.savedQueries],
			["sources", workspace.sources],
			["reports", workspace.reports],
			["workspacePresets", workspace.workspacePresets],
			["systemNodes", workspace.systemNodes],
		];

		for (const [name, values] of uniqueGroups) {
			for (const id of duplicateIds(values)) {
				context.addIssue({
					code: "custom",
					message: "Duplicate " + name + " id: " + id,
				});
			}
		}

		const projectById = new Map(workspace.projects.map((project) => [project.id, project]));
		const queryIds = new Set(workspace.savedQueries.map((query) => query.id));
		const sourceIds = new Set(workspace.sources.map((source) => source.id));
		const instructionById = new Map(workspace.instructionProfiles.map((profile) => [profile.id, profile]));
		const agentById = new Map(workspace.agentNodes.map((agent) => [agent.id, agent]));
		const systemNodeIds = new Set(workspace.systemNodes.map((node) => node.id));

		for (const project of workspace.projects) {
			if (project.parentProjectId && !projectById.has(project.parentProjectId)) {
				context.addIssue({
					code: "custom",
					message: "Project " + project.id + " references missing parent " + project.parentProjectId,
				});
			}
			if (project.statusQueryId && !queryIds.has(project.statusQueryId)) {
				context.addIssue({
					code: "custom",
					message: "Project " + project.id + " references missing status query " + project.statusQueryId,
				});
			}
		}

		const projectCycle = findParentCycle(
			workspace.projects.map((project) => project.id),
			(id) => projectById.get(id)?.parentProjectId,
		);
		if (projectCycle) {
			context.addIssue({
				code: "custom",
				message: "Project hierarchy cycle: " + projectCycle.join(" -> "),
			});
		}

		for (const item of workspace.workItems) {
			if (!projectById.has(item.projectId)) {
				context.addIssue({
					code: "custom",
					message: "Work item " + item.id + " references missing project " + item.projectId,
				});
			}
		}

		for (const profile of workspace.instructionProfiles) {
			if (!projectById.has(profile.projectId)) {
				context.addIssue({
					code: "custom",
					message: "Instruction profile " + profile.id + " references missing project " + profile.projectId,
				});
			}
		}

		for (const agent of workspace.agentNodes) {
			if (!projectById.has(agent.projectId)) {
				context.addIssue({
					code: "custom",
					message: "Agent " + agent.id + " references missing project " + agent.projectId,
				});
			}
			if (agent.parentId) {
				const parent = agentById.get(agent.parentId);
				if (!parent) {
					context.addIssue({
						code: "custom",
						message: "Agent " + agent.id + " references missing parent " + agent.parentId,
					});
				} else if (parent.projectId !== agent.projectId) {
					context.addIssue({
						code: "custom",
						message: "Agent " + agent.id + " parent belongs to another project",
					});
				}
			}
			if (agent.instructionProfileId) {
				const profile = instructionById.get(agent.instructionProfileId);
				if (!profile) {
					context.addIssue({
						code: "custom",
						message: "Agent " + agent.id + " references missing instruction profile " + agent.instructionProfileId,
					});
				} else if (profile.projectId !== agent.projectId) {
					context.addIssue({
						code: "custom",
						message: "Agent " + agent.id + " instruction profile belongs to another project",
					});
				}
			}
		}

		const agentCycle = findParentCycle(
			workspace.agentNodes.map((agent) => agent.id),
			(id) => agentById.get(id)?.parentId,
		);
		if (agentCycle) {
			context.addIssue({
				code: "custom",
				message: "Agent hierarchy cycle: " + agentCycle.join(" -> "),
			});
		}

		for (const report of workspace.reports) {
			for (const step of report.steps) {
				if (!sourceIds.has(step.sourceId)) {
					context.addIssue({
						code: "custom",
						message: "Report " + report.id + " references missing source " + step.sourceId,
					});
				}
			}
		}

		for (const preset of workspace.workspacePresets) {
			if (preset.defaultProjectId && !projectById.has(preset.defaultProjectId)) {
				context.addIssue({
					code: "custom",
					message: "Workspace preset " + preset.id + " references missing default project " + preset.defaultProjectId,
				});
			}
			for (const tab of preset.tabs) {
				if (tab.projectId && !projectById.has(tab.projectId)) {
					context.addIssue({
						code: "custom",
						message:
							"Workspace preset " + preset.id + " tab " + tab.id + " references missing project " + tab.projectId,
					});
				}
			}
		}

		const edgeKeys = new Set<string>();
		for (const edge of workspace.systemEdges) {
			const key = edge.from + "::" + edge.to;
			if (edgeKeys.has(key)) {
				context.addIssue({
					code: "custom",
					message: "Duplicate system edge: " + key,
				});
			}
			edgeKeys.add(key);

			if (!systemNodeIds.has(edge.from) || !systemNodeIds.has(edge.to)) {
				context.addIssue({
					code: "custom",
					message: "System edge " + key + " references a missing node",
				});
			}
		}
	});

export type WorkspaceExport = z.infer<typeof workspaceExportSchema>;

export function buildSeedWorkspace(source: "seed" | "import" = "seed"): WorkspaceExport {
	return {
		schemaVersion: 1,
		metadata: {
			name: "Datapass Mongo Control",
			source,
			exportedAt: new Date().toISOString(),
		},
		projects,
		workItems,
		agentNodes,
		instructionProfiles,
		savedQueries,
		sources: sourceCatalog,
		reports: reportCatalog,
		workspacePresets,
		systemNodes: foilNodes,
		systemEdges: foilEdges,
	};
}

export const controlResourceTypeSchema = z.enum([
	"project",
	"workItem",
	"agentNode",
	"instructionProfile",
	"savedQuery",
	"sourceDescriptor",
	"reportDefinition",
	"workspacePreset",
	"systemNode",
	"systemEdge",
]);

export const controlChangeOperationSchema = z
	.object({
		id: z.string().min(1).max(120),
		kind: z.enum(["upsert", "delete"]),
		resourceType: controlResourceTypeSchema,
		resourceId: z.string().min(1).max(200),
		value: jsonRecord.optional(),
		rationale: z.string().max(2000).optional(),
	})
	.superRefine((operation, context) => {
		if (operation.kind === "upsert" && !operation.value) {
			context.addIssue({
				code: "custom",
				message: "Upsert operations require value",
			});
		}
		if (operation.kind === "delete" && operation.value) {
			context.addIssue({
				code: "custom",
				message: "Delete operations must not include value",
			});
		}
	});

export const controlChangeSetSchema = z.object({
	schemaVersion: z.literal(1),
	id: z.string().min(1).max(120),
	source: z.string().min(1).max(200),
	summary: z.string().min(1).max(2000),
	createdAt: z.string(),
	baseRevision: z.number().int().nonnegative(),
	baseFingerprint: z.string().min(1).max(128),
	operations: z.array(controlChangeOperationSchema).min(1).max(50),
});

export type ControlChangeSetInput = z.infer<typeof controlChangeSetSchema>;
