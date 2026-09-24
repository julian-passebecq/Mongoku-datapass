import { describe, expect, it } from "vitest";
import {
	adaptLegacyGlobalWorkspace,
	detectControlPersistenceMode,
	legacyEntityToProject,
	legacyWorkItemToWorkspaceItem,
} from "$lib/datapass/legacyGlobalAdapter";

describe("legacy DATAPASSCONTROL adapter", () => {
	it("detects workspace-v1 before legacy-global when both are present", () => {
		expect(detectControlPersistenceMode(["projects", "entities", "work_items"])).toBe("workspace-v1");
		expect(detectControlPersistenceMode(["entities", "work_items", "repositories"])).toBe("legacy-global");
		expect(detectControlPersistenceMode(["events"])).toBe("empty-or-unknown");
	});

	it("maps live entity status without losing the raw value", () => {
		const project = legacyEntityToProject(
			{
				entity_id: "datapass_vscode",
				entity_type: "tool",
				name: "DataPass VS Code",
				category: "developer_tooling",
				status: "ready_for_local_install_test",
				organization_id: "datapass",
				parent_entity_id: "datapass",
				canonical_repo: "julian-passebecq/datapass-vscode",
				test_readiness: "READY_FOR_NATIVE_TEST",
				health: "ci_green",
				next_action: "Install the VSIX.",
			},
			2,
			new Set(["datapass", "datapass_vscode"]),
		);

		expect(project).not.toBeNull();
		expect(project?.status).toBe("active");
		expect(project?.kanbanStatus).toBe("todo");
		expect(project?.rawStatus).toBe("ready_for_local_install_test");
		expect(project?.organizationId).toBe("datapass");
		expect(project?.parentProjectId).toBe("datapass");
		expect(project?.githubRepo).toBe("julian-passebecq/datapass-vscode");
		expect(project?.progressKnown).toBe(false);
	});

	it("maps stopped domains to done while preserving source status", () => {
		const project = legacyEntityToProject(
			{
				entity_id: "foil_hydro",
				entity_type: "domain",
				name: "FOIL Hydro",
				category: "domain_project",
				status: "stopped",
				organization_id: "foil",
			},
			0,
			new Set(["foil_hydro"]),
		);

		expect(project?.status).toBe("done");
		expect(project?.kanbanStatus).toBe("done");
		expect(project?.rawStatus).toBe("stopped");
	});

	it("maps global work semantics and retains raw status, kind and severity", () => {
		const item = legacyWorkItemToWorkspaceItem({
			work_item_id: "T001",
			kind: "conflict",
			project_id: "datapass",
			priority: "P0",
			status: "blocked",
			severity: "critical",
			title: "Resolve contract mismatch",
			next_action: "Use the compatibility adapter.",
		});

		expect(item).not.toBeNull();
		expect(item?.status).toBe("blocked");
		expect(item?.type).toBe("bug");
		expect(item?.priority).toBe("high");
		expect(item?.rawStatus).toBe("blocked");
		expect(item?.rawKind).toBe("conflict");
		expect(item?.severity).toBe("critical");
	});

	it("creates a compatibility project for global portfolio work without an entity", () => {
		const adapted = adaptLegacyGlobalWorkspace(
			[
				{
					entity_id: "datapass",
					entity_type: "product",
					name: "Datapass",
					category: "core_product",
					status: "active",
				},
			],
			[
				{
					work_item_id: "B001",
					kind: "backlog",
					project_id: "portfolio",
					priority: "P1",
					status: "todo",
					severity: "medium",
					title: "Review remaining repositories",
				},
			],
		);

		expect(adapted.projects.some((project) => project.id === "portfolio")).toBe(true);
		expect(adapted.workItems[0].projectId).toBe("portfolio");
		expect(adapted.projects.find((project) => project.id === "portfolio")?.tags).toContain(
			"synthetic-compatibility-node",
		);
	});
});
