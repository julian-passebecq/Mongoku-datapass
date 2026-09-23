import { createHash, randomUUID } from "node:crypto";
import {
	agentNodeSchema,
	controlChangeSetSchema,
	instructionProfileSchema,
	projectSchema,
	savedMongoQuerySchema,
	systemEdgeSchema,
	systemNodeSchema,
	workspaceExportSchema,
	workspacePresetSchema,
	workItemSchema,
	type ControlChangeSetInput,
	type WorkspaceExport
} from "$lib/datapass/workspaceSchema";
import type { ControlChangeOperation, ControlResourceType } from "$lib/datapass/controlPlane";
import {
	controlWritesEnabled,
	getControlDb,
	loadControlWorkspace,
	saveControlWorkspace
} from "$lib/server/datapassControl";

const META_ID = "workspace";
const MAX_REVISIONS = 100;
const MAX_ACTIVITY = 500;
const MAX_CHANGESETS = 200;

type WorkspaceIdentity = {
	revision: number;
	fingerprint: string;
	updatedAt: string;
};

type ChangePreview = {
	operationId: string;
	kind: "upsert" | "delete";
	resourceType: ControlResourceType;
	resourceId: string;
	before: unknown;
	after: unknown;
	changed: boolean;
	rationale?: string;
};

type StoredChangeSet = {
	id: string;
	status: "staged" | "accepted" | "rejected" | "stale";
	createdAt: string;
	decidedAt?: string;
	source: string;
	summary: string;
	baseRevision: number;
	baseFingerprint: string;
	operations: ControlChangeOperation[];
	preview: ChangePreview[];
	selectedOperationIds?: string[];
	reason?: string;
	resultRevision?: number;
	resultFingerprint?: string;
};

function stable(value: unknown): string {
	if (Array.isArray(value)) {
		return "[" + value.map(stable).join(",") + "]";
	}
	if (value && typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, nested]) => JSON.stringify(key) + ":" + stable(nested));
		return "{" + entries.join(",") + "}";
	}
	return JSON.stringify(value) ?? "undefined";
}

function workspacePayload(workspace: WorkspaceExport) {
	return {
		schemaVersion: workspace.schemaVersion,
		projects: workspace.projects,
		workItems: workspace.workItems,
		agentNodes: workspace.agentNodes,
		instructionProfiles: workspace.instructionProfiles,
		savedQueries: workspace.savedQueries,
		workspacePresets: workspace.workspacePresets,
		systemNodes: workspace.systemNodes,
		systemEdges: workspace.systemEdges
	};
}

export function fingerprintWorkspace(workspace: WorkspaceExport): string {
	return createHash("sha256").update(stable(workspacePayload(workspace))).digest("hex");
}

async function ensureIdentity(workspace: WorkspaceExport): Promise<WorkspaceIdentity> {
	const db = await getControlDb();
	const current = await db.collection("control_meta").findOne({ id: META_ID });
	const fingerprint = fingerprintWorkspace(workspace);

	if (current && typeof current.revision === "number" && typeof current.fingerprint === "string") {
		return {
			revision: current.revision,
			fingerprint: current.fingerprint,
			updatedAt: String(current.updatedAt ?? new Date().toISOString())
		};
	}

	const identity: WorkspaceIdentity = {
		revision: 0,
		fingerprint,
		updatedAt: new Date().toISOString()
	};
	if (controlWritesEnabled()) {
		await db.collection("control_meta").updateOne(
			{ id: META_ID },
			{ $set: { id: META_ID, ...identity } },
			{ upsert: true }
		);
	}
	return identity;
}

export async function getWorkspaceIdentity(): Promise<WorkspaceIdentity> {
	const workspace = await loadControlWorkspace();
	try {
		return await ensureIdentity(workspace);
	} catch {
		return {
			revision: 0,
			fingerprint: fingerprintWorkspace(workspace),
			updatedAt: workspace.metadata.exportedAt
		};
	}
}

function collectionFor(workspace: WorkspaceExport, resourceType: ControlResourceType): unknown[] {
	switch (resourceType) {
		case "project":
			return workspace.projects;
		case "workItem":
			return workspace.workItems;
		case "agentNode":
			return workspace.agentNodes;
		case "instructionProfile":
			return workspace.instructionProfiles;
		case "savedQuery":
			return workspace.savedQueries;
		case "workspacePreset":
			return workspace.workspacePresets;
		case "systemNode":
			return workspace.systemNodes;
		case "systemEdge":
			return workspace.systemEdges;
	}
}

function resourceKey(resourceType: ControlResourceType, value: unknown): string {
	if (resourceType === "systemEdge") {
		const edge = systemEdgeSchema.parse(value);
		return edge.from + "::" + edge.to;
	}
	if (!value || typeof value !== "object" || !("id" in value)) {
		throw new Error("Resource requires id");
	}
	return String((value as { id: unknown }).id);
}

function parseResource(resourceType: ControlResourceType, value: unknown): unknown {
	switch (resourceType) {
		case "project":
			return projectSchema.parse(value);
		case "workItem":
			return workItemSchema.parse(value);
		case "agentNode":
			return agentNodeSchema.parse(value);
		case "instructionProfile":
			return instructionProfileSchema.parse(value);
		case "savedQuery":
			return savedMongoQuerySchema.parse(value);
		case "workspacePreset":
			return workspacePresetSchema.parse(value);
		case "systemNode":
			return systemNodeSchema.parse(value);
		case "systemEdge":
			return systemEdgeSchema.parse(value);
	}
}

function findResource(workspace: WorkspaceExport, resourceType: ControlResourceType, resourceId: string): unknown {
	return collectionFor(workspace, resourceType).find(
		(value) => resourceKey(resourceType, value) === resourceId
	);
}

function applyOperation(workspace: WorkspaceExport, operation: ControlChangeOperation): ChangePreview {
	const collection = collectionFor(workspace, operation.resourceType);
	const before = findResource(workspace, operation.resourceType, operation.resourceId);

	if (operation.kind === "delete") {
		const index = collection.findIndex(
			(value) => resourceKey(operation.resourceType, value) === operation.resourceId
		);
		if (index >= 0) {
			collection.splice(index, 1);
		}
		return {
			operationId: operation.id,
			kind: operation.kind,
			resourceType: operation.resourceType,
			resourceId: operation.resourceId,
			before: structuredClone(before),
			after: undefined,
			changed: before !== undefined,
			rationale: operation.rationale
		};
	}

	const parsed = parseResource(operation.resourceType, operation.value);
	const actualId = resourceKey(operation.resourceType, parsed);
	if (actualId !== operation.resourceId) {
		throw new Error(
			"Operation resourceId does not match payload identity: " +
				operation.resourceId +
				" != " +
				actualId
		);
	}

	const index = collection.findIndex(
		(value) => resourceKey(operation.resourceType, value) === operation.resourceId
	);
	if (index >= 0) {
		collection[index] = parsed;
	} else {
		collection.push(parsed);
	}

	return {
		operationId: operation.id,
		kind: operation.kind,
		resourceType: operation.resourceType,
		resourceId: operation.resourceId,
		before: structuredClone(before),
		after: structuredClone(parsed),
		changed: stable(before) !== stable(parsed),
		rationale: operation.rationale
	};
}

function selectOperations(changeSet: ControlChangeSetInput, selectedIds?: string[]) {
	const ids = selectedIds ?? changeSet.operations.map((operation) => operation.id);
	if (ids.length === 0 || new Set(ids).size !== ids.length) {
		throw new Error("Select at least one distinct operation");
	}
	for (const id of ids) {
		if (!changeSet.operations.some((operation) => operation.id === id)) {
			throw new Error("Unknown selected operation: " + id);
		}
	}
	return changeSet.operations.filter((operation) => ids.includes(operation.id));
}

export async function previewControlChangeSet(input: unknown, selectedIds?: string[]) {
	const changeSet = controlChangeSetSchema.parse(input);
	const workspace = await loadControlWorkspace();
	const identity = await getWorkspaceIdentity();

	if (
		changeSet.baseRevision !== identity.revision ||
		changeSet.baseFingerprint !== identity.fingerprint
	) {
		return {
			ok: false as const,
			stale: true as const,
			expected: {
				revision: changeSet.baseRevision,
				fingerprint: changeSet.baseFingerprint
			},
			current: identity
		};
	}

	const candidate = structuredClone(workspace);
	const operations = selectOperations(changeSet, selectedIds);
	const preview = operations.map((operation) => applyOperation(candidate, operation));
	workspaceExportSchema.parse(candidate);

	return {
		ok: true as const,
		stale: false as const,
		changeSet,
		identity,
		preview,
		resultFingerprint: fingerprintWorkspace(candidate)
	};
}

export async function stageControlChangeSet(input: unknown): Promise<StoredChangeSet> {
	if (!controlWritesEnabled()) {
		throw new Error("Datapass control writes are disabled");
	}

	const preview = await previewControlChangeSet(input);
	if (!preview.ok) {
		throw new Error(
			"ChangeSet is stale. Re-read the workspace and preview against the current revision."
		);
	}

	const db = await getControlDb();
	const existing = await db.collection("control_changesets").findOne({ id: preview.changeSet.id });
	if (existing) {
		throw new Error("ChangeSet id already exists");
	}

	const row: StoredChangeSet = {
		id: preview.changeSet.id,
		status: "staged",
		createdAt: preview.changeSet.createdAt,
		source: preview.changeSet.source,
		summary: preview.changeSet.summary,
		baseRevision: preview.changeSet.baseRevision,
		baseFingerprint: preview.changeSet.baseFingerprint,
		operations: preview.changeSet.operations,
		preview: preview.preview
	};

	await db.collection("control_changesets").insertOne(row);
	await trimCollection("control_changesets", MAX_CHANGESETS);
	await appendActivity({
		action: "changeset.staged",
		source: row.source,
		summary: row.summary,
		changeSetId: row.id,
		revision: row.baseRevision
	});
	return row;
}

async function trimCollection(name: string, limit: number) {
	const db = await getControlDb();
	const count = await db.collection(name).countDocuments();
	if (count <= limit) {
		return;
	}
	const remove = await db
		.collection(name)
		.find({})
		.sort({ createdAt: 1 })
		.limit(count - limit)
		.project({ _id: 1 })
		.toArray();
	if (remove.length > 0) {
		await db.collection(name).deleteMany({ _id: { $in: remove.map((row) => row._id) } });
	}
}

async function appendActivity(input: {
	action: string;
	source: string;
	summary: string;
	revision: number;
	changeSetId?: string;
}) {
	const db = await getControlDb();
	await db.collection("control_activity").insertOne({
		id: randomUUID(),
		createdAt: new Date().toISOString(),
		...input
	});
	await trimCollection("control_activity", MAX_ACTIVITY);
}

async function commitWorkspace(input: {
	workspace: WorkspaceExport;
	source: string;
	summary: string;
	changeSetId?: string;
	selectedOperationIds?: string[];
}) {
	const current = await loadControlWorkspace();
	const identity = await ensureIdentity(current);
	const nextRevision = identity.revision + 1;
	const fingerprint = fingerprintWorkspace(input.workspace);
	const db = await getControlDb();
	const createdAt = new Date().toISOString();

	await saveControlWorkspace(input.workspace, "replace");

	await db.collection("control_revisions").insertOne({
		id: "revision-" + nextRevision + "-" + randomUUID(),
		revision: nextRevision,
		parentRevision: identity.revision,
		createdAt,
		source: input.source,
		summary: input.summary,
		changeSetId: input.changeSetId,
		selectedOperationIds: input.selectedOperationIds,
		fingerprint,
		workspace: workspacePayload(input.workspace)
	});
	await trimCollection("control_revisions", MAX_REVISIONS);

	await db.collection("control_meta").updateOne(
		{ id: META_ID },
		{
			$set: {
				id: META_ID,
				revision: nextRevision,
				fingerprint,
				updatedAt: createdAt
			}
		},
		{ upsert: true }
	);

	await appendActivity({
		action: input.changeSetId ? "changeset.accepted" : "workspace.committed",
		source: input.source,
		summary: input.summary,
		changeSetId: input.changeSetId,
		revision: nextRevision
	});

	return { revision: nextRevision, fingerprint, updatedAt: createdAt };
}

export async function commitDirectWorkspace(
	workspace: WorkspaceExport,
	source: string,
	summary: string
) {
	if (!controlWritesEnabled()) {
		throw new Error("Datapass control writes are disabled");
	}
	const parsed = workspaceExportSchema.parse(workspace);
	return commitWorkspace({ workspace: parsed, source, summary });
}

export async function acceptControlChangeSet(id: string, selectedIds?: string[]) {
	if (!controlWritesEnabled()) {
		throw new Error("Datapass control writes are disabled");
	}

	const db = await getControlDb();
	const row = (await db.collection("control_changesets").findOne({ id })) as StoredChangeSet | null;
	if (!row || row.status !== "staged") {
		throw new Error("Only staged ChangeSets can be accepted");
	}

	const input: ControlChangeSetInput = {
		schemaVersion: 1,
		id: row.id,
		source: row.source,
		summary: row.summary,
		createdAt: row.createdAt,
		baseRevision: row.baseRevision,
		baseFingerprint: row.baseFingerprint,
		operations: row.operations
	};

	const preview = await previewControlChangeSet(input, selectedIds);
	if (!preview.ok) {
		await db.collection("control_changesets").updateOne(
			{ id },
			{
				$set: {
					status: "stale",
					decidedAt: new Date().toISOString(),
					reason: "Workspace changed since this proposal was staged"
				}
			}
		);
		await appendActivity({
			action: "changeset.stale",
			source: row.source,
			summary: row.summary,
			changeSetId: row.id,
			revision: preview.current.revision
		});
		throw new Error("ChangeSet is stale and must be re-previewed");
	}

	const workspace = await loadControlWorkspace();
	const candidate = structuredClone(workspace);
	const operations = selectOperations(input, selectedIds);
	for (const operation of operations) {
		applyOperation(candidate, operation);
	}
	workspaceExportSchema.parse(candidate);

	const identity = await commitWorkspace({
		workspace: candidate,
		source: row.source,
		summary: row.summary,
		changeSetId: row.id,
		selectedOperationIds: operations.map((operation) => operation.id)
	});

	await db.collection("control_changesets").updateOne(
		{ id },
		{
			$set: {
				status: "accepted",
				decidedAt: identity.updatedAt,
				selectedOperationIds: operations.map((operation) => operation.id),
				resultRevision: identity.revision,
				resultFingerprint: identity.fingerprint
			}
		}
	);

	return identity;
}

export async function rejectControlChangeSet(id: string) {
	if (!controlWritesEnabled()) {
		throw new Error("Datapass control writes are disabled");
	}
	const db = await getControlDb();
	const row = (await db.collection("control_changesets").findOne({ id })) as StoredChangeSet | null;
	if (!row || !["staged", "stale"].includes(row.status)) {
		throw new Error("Only staged or stale ChangeSets can be rejected");
	}
	const decidedAt = new Date().toISOString();
	await db.collection("control_changesets").updateOne(
		{ id },
		{ $set: { status: "rejected", decidedAt } }
	);
	await appendActivity({
		action: "changeset.rejected",
		source: row.source,
		summary: row.summary,
		changeSetId: row.id,
		revision: (await getWorkspaceIdentity()).revision
	});
	return { ok: true, decidedAt };
}

export async function listControlChangeSets(limit = 100) {
	const db = await getControlDb();
	return db
		.collection("control_changesets")
		.find({})
		.sort({ createdAt: -1 })
		.limit(Math.min(Math.max(limit, 1), 100))
		.project({ _id: 0 })
		.toArray();
}

export async function listControlActivity(limit = 100) {
	const db = await getControlDb();
	return db
		.collection("control_activity")
		.find({})
		.sort({ createdAt: -1 })
		.limit(Math.min(Math.max(limit, 1), 100))
		.project({ _id: 0 })
		.toArray();
}

export async function listControlRevisions(limit = 100) {
	const db = await getControlDb();
	return db
		.collection("control_revisions")
		.find({})
		.sort({ revision: -1 })
		.limit(Math.min(Math.max(limit, 1), 100))
		.project({ _id: 0, workspace: 0 })
		.toArray();
}

export async function getControlRevision(revision: number) {
	const db = await getControlDb();
	const row = await db
		.collection("control_revisions")
		.findOne({ revision }, { projection: { _id: 0 } });
	return row ?? null;
}

export async function restoreControlRevision(revision: number, expected: WorkspaceIdentity) {
	if (!controlWritesEnabled()) {
		throw new Error("Datapass control writes are disabled");
	}
	const current = await getWorkspaceIdentity();
	if (
		current.revision !== expected.revision ||
		current.fingerprint !== expected.fingerprint
	) {
		throw new Error("Workspace changed before restore. Refresh history first.");
	}

	const row = await getControlRevision(revision);
	if (!row || !row.workspace) {
		throw new Error("Historical revision is unavailable");
	}

	const currentWorkspace = await loadControlWorkspace();
	const restored = workspaceExportSchema.parse({
		...currentWorkspace,
		...(row.workspace as object),
		metadata: currentWorkspace.metadata
	});

	return commitWorkspace({
		workspace: restored,
		source: "restore",
		summary: "Restore revision " + revision + " as new revision"
	});
}

export async function compareControlRevisions(leftRevision: number, rightRevision: number) {
	const left = await getControlRevision(leftRevision);
	const right = await getControlRevision(rightRevision);
	if (!left || !right || !left.workspace || !right.workspace) {
		throw new Error("One or both revisions are unavailable");
	}

	const changes: { path: string; before: unknown; after: unknown }[] = [];
	function walk(before: unknown, after: unknown, path: string) {
		if (stable(before) === stable(after)) {
			return;
		}
		if (
			before &&
			after &&
			typeof before === "object" &&
			typeof after === "object" &&
			!Array.isArray(before) &&
			!Array.isArray(after)
		) {
			const keys = new Set([
				...Object.keys(before as Record<string, unknown>),
				...Object.keys(after as Record<string, unknown>)
			]);
			for (const key of keys) {
				walk(
					(before as Record<string, unknown>)[key],
					(after as Record<string, unknown>)[key],
					path ? path + "." + key : key
				);
			}
			return;
		}
		changes.push({ path, before, after });
	}

	walk(left.workspace, right.workspace, "");
	return { left, right, changes: changes.slice(0, 500) };
}
