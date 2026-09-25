import { describe, expect, it } from "vitest";
import { applyReportSemantics, normalizeReportLimit, normalizeWorkStatus } from "$lib/datapass/reportSemantics";
import { isFoilRootProject } from "$lib/datapass/controlPlane";
import { reportCatalog } from "$lib/datapass/reporting";

describe("FOIL report semantics", () => {
	it("surfaces a blocked P0 embedded task from a P0_P1 parent", () => {
		const rows = applyReportSemantics("FOIL_P0_BLOCKERS", "blockers", "backlog", [
			{
				_id: "BL-PARENT",
				priority: "P0_P1",
				status: "ACTIVE",
				title: "Parent",
				tasks: [
					{ id: "task-1", label: "Critical child", priority: "P0", status: "BLOCKED" },
					{
						id: "task-2",
						label: "Finished child",
						priority: "P0",
						status: "QUALIFIED_COMPLETE",
					},
				],
			},
		]);

		expect(rows).toHaveLength(1);
		expect(rows[0]._id).toBe("BL-PARENT::task-1");
		expect(rows[0].displayStatus).toBe("BLOCKED");
		expect(rows[0].rawStatus).toBe("BLOCKED");
	});

	it("does not expose QUALIFIED_COMPLETE as executable next work", () => {
		const rows = applyReportSemantics("FOIL_NEXT", "backlog", "backlog", [
			{
				_id: "BL-1",
				priority: "P0_P1",
				status: "ACTIVE",
				tasks: [
					{ id: "done", title: "Done", priority: "P0", status: "QUALIFIED_COMPLETE" },
					{ id: "ready", title: "Ready", priority: "P1", status: "READY" },
				],
			},
		]);

		expect(rows.some((row) => row._id === "BL-1::done")).toBe(false);
		expect(rows.some((row) => row._id === "BL-1::ready")).toBe(true);
	});

	it("normalizes completion and waiting states without losing raw status", () => {
		expect(normalizeWorkStatus("QUALIFIED_COMPLETE")).toBe("DONE");
		expect(normalizeWorkStatus("WAITING_FRANCIS")).toBe("WAITING_EXTERNAL");
		expect(normalizeWorkStatus("OPEN_VALIDATION")).toBe("VERIFY");
	});

	it("matches whole words so negated or partial states are not read as done", () => {
		expect(normalizeWorkStatus("partial_complete")).toBe("VERIFY");
		expect(normalizeWorkStatus("partial_green")).toBe("VERIFY");
		expect(normalizeWorkStatus("not_live_proven")).toBe("VERIFY");
		expect(normalizeWorkStatus("unresolved")).not.toBe("DONE");
		expect(normalizeWorkStatus("incomplete")).not.toBe("DONE");
		expect(normalizeWorkStatus("unblocked")).not.toBe("BLOCKED");
		expect(normalizeWorkStatus("proposed_not_deployed")).toBe("BACKLOG");
	});

	it("maps the raw statuses seen in DATAPASSCONTROL to a known display state", () => {
		const expected: Record<string, string> = {
			stopped: "DEFERRED",
			ongoing: "ACTIVE",
			green: "DONE",
			mitigated: "DONE",
			merged_main_ci_green: "DONE",
			reference_completed: "DONE",
			candidate: "BACKLOG",
			prototype: "ACTIVE",
			active_donor: "ACTIVE",
			donor_reference: "DEFERRED",
			legacy_reference: "DEFERRED",
			needs_content_audit: "VERIFY",
			main_v23_fixes_merged_followup_qualification: "VERIFY",
			qualified_main_refocus_active: "VERIFY",
			ready_for_manual_ui_test: "READY",
			todo: "READY",
			planned: "BACKLOG",
		};
		for (const [raw, display] of Object.entries(expected)) {
			expect([raw, normalizeWorkStatus(raw)]).toEqual([raw, display]);
		}
	});

	it("treats both FOIL root ids as the FOIL cockpit", () => {
		expect(isFoilRootProject("foil")).toBe(true);
		expect(isFoilRootProject("foil_project")).toBe(true);
		expect(isFoilRootProject("foil_it_dev")).toBe(false);
		expect(isFoilRootProject(null)).toBe(false);

		const report = reportCatalog.find((candidate) => candidate.steps.some((step) => step.id === "global-work"));
		const step = report?.steps.find((candidate) => candidate.id === "global-work");
		expect(step?.filter).toEqual({ project_id: { $in: ["foil", "foil_project"] } });
	});

	it("rejects zero and negative requested limits", () => {
		expect(() => normalizeReportLimit(0)).toThrow(/positive integer/);
		expect(() => normalizeReportLimit(-1)).toThrow(/positive integer/);
	});

	it("caps oversized requested limits", () => {
		expect(normalizeReportLimit(5000, 500, 500)).toEqual({
			requestedLimit: 5000,
			effectiveLimit: 500,
		});
	});

	it("matches the known Core conflict shape", () => {
		const report = reportCatalog.find((candidate) => candidate.id === "FOIL_CONTRADICTIONS");
		const step = report?.steps.find((candidate) => candidate.id === "core-conflicts");
		expect(step).toBeDefined();

		const filter = step?.filter as {
			$or?: Array<Record<string, unknown>>;
			status?: { $nin?: string[] };
		};
		const conflictMatchers = filter.$or ?? [];
		const hasKindConflictMatcher = conflictMatchers.some((entry) => {
			const kind = entry.kind as { $regex?: string } | undefined;
			return kind?.$regex?.includes("CONFLICT") === true;
		});
		expect(hasKindConflictMatcher).toBe(true);
		expect(filter.status?.$nin).not.toContain("OPEN_VALIDATION");
	});
});
