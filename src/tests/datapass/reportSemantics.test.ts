import { describe, expect, it } from "vitest";
import { applyReportSemantics, normalizeReportLimit, normalizeWorkStatus } from "$lib/datapass/reportSemantics";
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
