import { z } from "zod";
import {
	agentNodes,
	foilEdges,
	foilNodes,
	instructionProfiles,
	projects,
	savedQueries,
	workspacePresets,
	workItems
} from "./controlPlane";

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
	activeItems: z.number().int().min(0),
	kanbanStatus: workStatus,
	statusQueryId: z.string().min(1).optional(),
	tags: z.array(z.string()),
	githubRepo: z.string().optional(),
	mongoContextKey: z.string().optional(),
	mongoNamespaces: z.array(z.string()).optional()
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
	tags: z.array(z.string())
});

export const instructionProfileSchema = z.object({
	id: z.string().min(1),
	projectId: z.string().min(1),
	name: z.string().min(1),
	version: z.number().int().positive(),
	summary: z.string(),
	body: z.string(),
	tags: z.array(z.string())
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
	githubRepo: z.string().optional()
});

const jsonRecord = z.record(z.string(), z.unknown());

export const savedMongoQuerySchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	description: z.string(),
	collection: z.string().min(1),
	operation: z.enum(["find", "aggregate"]),
	filter: jsonRecord.optional(),
	pipeline: z.array(jsonRecord).optional(),
	sort: z.record(z.string(), z.union([z.literal(1), z.literal(-1)])).optional(),
	limit: z.number().int().positive().max(10000).optional(),
	parameters: z.array(
		z.object({
			name: z.string().min(1),
			type: z.enum(["string", "string[]"]),
			source: z.enum(["project", "project-tree", "manual"]).optional()
		})
	),
	presentation: z.enum(["project-board", "status-summary", "table", "count", "calendar", "notes", "detail", "dashboard"]),
	readOnly: z.literal(true),
	tags: z.array(z.string())
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
			projectId: z.string().optional()
		})
	),
	bookmarks: z.array(
		z.object({
			id: z.string().min(1),
			title: z.string().min(1),
			href: z.string().min(1)
		})
	),
	leftPanelCollapsed: z.boolean(),
	rightPanelOpen: z.boolean(),
	rightPanelMode: z.enum(["context", "bookmarks", "queries", "settings"]),
	tags: z.array(z.string())
});

export const systemNodeSchema = z.object({
	id: z.string().min(1),
	label: z.string().min(1),
	kind: z.enum(["source", "runtime", "stream", "database", "analytics"]),
	state: z.enum(["healthy", "warning", "offline"]),
	detail: z.string()
});

export const systemEdgeSchema = z.object({
	from: z.string().min(1),
	to: z.string().min(1),
	label: z.string()
});

export const workspaceExportSchema = z.object({
	schemaVersion: z.literal(1),
	metadata: z.object({
		name: z.string(),
		source: z.enum(["seed", "mongo", "import"]),
		exportedAt: z.string(),
		controlDatabase: z.string().optional()
	}),
	projects: z.array(projectSchema),
	workItems: z.array(workItemSchema),
	agentNodes: z.array(agentNodeSchema),
	instructionProfiles: z.array(instructionProfileSchema),
	savedQueries: z.array(savedMongoQuerySchema),
	workspacePresets: z.array(workspacePresetSchema),
	systemNodes: z.array(systemNodeSchema),
	systemEdges: z.array(systemEdgeSchema)
});

export type WorkspaceExport = z.infer<typeof workspaceExportSchema>;

export function buildSeedWorkspace(source: "seed" | "import" = "seed"): WorkspaceExport {
	return {
		schemaVersion: 1,
		metadata: {
			name: "Datapass Mongo Control",
			source,
			exportedAt: new Date().toISOString()
		},
		projects,
		workItems,
		agentNodes,
		instructionProfiles,
		savedQueries,
		workspacePresets,
		systemNodes: foilNodes,
		systemEdges: foilEdges
	};
}
