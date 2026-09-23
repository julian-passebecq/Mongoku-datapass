import { describe, expect, it } from "vitest";
import { buildSeedWorkspace, workspaceExportSchema, type WorkspaceExport } from "$lib/datapass/workspaceSchema";

function seed(): WorkspaceExport {
	return structuredClone(buildSeedWorkspace());
}

describe("Datapass workspace schema", () => {
	it("accepts the canonical seed workspace", () => {
		const result = workspaceExportSchema.safeParse(seed());
		expect(result.success).toBe(true);
	});

	it("rejects duplicate project ids", () => {
		const workspace = seed();
		workspace.projects.push(structuredClone(workspace.projects[0]));

		const result = workspaceExportSchema.safeParse(workspace);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((issue) => issue.message.includes("Duplicate projects id"))).toBe(true);
		}
	});

	it("rejects project hierarchy cycles", () => {
		const workspace = seed();
		const root = workspace.projects.find((project) => project.id === "datapass-studio");
		expect(root).toBeDefined();
		root!.parentProjectId = "datapass-mosaic";

		const result = workspaceExportSchema.safeParse(workspace);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((issue) => issue.message.includes("Project hierarchy cycle"))).toBe(true);
		}
	});

	it("rejects agent hierarchy cycles", () => {
		const workspace = seed();
		const leader = workspace.agentNodes.find((agent) => agent.id === "foil-leader");
		expect(leader).toBeDefined();
		leader!.parentId = "foil-code";

		const result = workspaceExportSchema.safeParse(workspace);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((issue) => issue.message.includes("Agent hierarchy cycle"))).toBe(true);
		}
	});

	it("rejects missing project status query references", () => {
		const workspace = seed();
		workspace.projects[0].statusQueryId = "missing-query";

		const result = workspaceExportSchema.safeParse(workspace);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((issue) => issue.message.includes("missing status query"))).toBe(true);
		}
	});

	it("rejects cross-project agent parents", () => {
		const workspace = seed();
		workspace.agentNodes.push({
			id: "datapass-agent",
			projectId: "datapass-studio",
			label: "Datapass agent",
			role: "Test",
			parentId: "foil-leader",
			responsibilities: [],
			mongoScope: [],
			tags: [],
		});

		const result = workspaceExportSchema.safeParse(workspace);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((issue) => issue.message.includes("parent belongs to another project"))).toBe(
				true,
			);
		}
	});

	it("rejects system edges that reference missing nodes", () => {
		const workspace = seed();
		workspace.systemEdges.push({
			from: "missing-node",
			to: "mongo",
			label: "invalid",
		});

		const result = workspaceExportSchema.safeParse(workspace);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((issue) => issue.message.includes("references a missing node"))).toBe(true);
		}
	});
});
