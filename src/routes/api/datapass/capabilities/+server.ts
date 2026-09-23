import { json } from "@sveltejs/kit";
import { getWorkspaceIdentity } from "$lib/server/datapassHistory";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
	const identity = await getWorkspaceIdentity();

	return json({
		schemaVersion: 1,
		kind: "datapass-control-capabilities",
		reviewRequired: true,
		identity,
		resources: [
			"project",
			"workItem",
			"agentNode",
			"instructionProfile",
			"savedQuery",
			"workspacePreset",
			"systemNode",
			"systemEdge"
		],
		operations: ["upsert", "delete"],
		workflow: ["preview", "stage", "accept-selected", "reject", "restore-as-new"],
		limits: {
			operationsPerChangeSet: 50,
			revisions: 100,
			changeSets: 200,
			activity: 500
		},
		savedQuery: {
			operations: ["find", "aggregate"],
			readOnly: true
		},
		endpoints: {
			workspace: "/api/datapass/workspace",
			previewChangeSet: "/api/datapass/changesets/preview",
			changeSets: "/api/datapass/changesets",
			changeSetDecision: "/api/datapass/changesets/:id",
			history: "/api/datapass/history",
			restore: "/api/datapass/history/restore",
			query: "/api/datapass/query/:queryId"
		}
	}, {
		headers: { "cache-control": "no-store" }
	});
};
