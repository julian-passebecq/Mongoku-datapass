import { describe, expect, it } from "vitest";
import { reportCatalog } from "$lib/datapass/reporting";
import {
	applyReportSemantics,
	normalizeReportLimit
} from "$lib/datapass/reportSemantics";

function report(id: string) {
	const value = reportCatalog.find((candidate) => candidate.id === id);
	if (!value) {
		throw new Error("Missing report " + id);
	}
	return value;
}

function valueAt(row: Record<string, unknown>, path: string): unknown {
	return path.split(".").reduce<unknown>((value, key) => {
		if (!value || typeof value !== "object" || Array.isArray(value)) {
			return undefined;
		}
		return (value as Record<string, unknown>)[key];
	}, row);
}

function matchCondition(value: unknown, condition: unknown): boolean {
	if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
		return value === condition;
	}
	const record = condition as Record<string, unknown>;
	if ("$regex" in record) {
		const regex = new RegExp(String(record.$regex), String(record.$options ?? ""));
		return regex.test(String(value ?? ""));
	}
	if ("$exists" in record) {
		return (value !== undefined) === Boolean(record.$exists);
	}
	if ("$in" in record) {
		return Array.isArray(record.$in) && record.$in.includes(value);
	}
	if ("$nin" in record) {
		return Array.isArray(record.$nin) && !record.$nin.includes(value);
	}
	if ("$elemMatch" in record) {
		return (
			Array.isArray(value) &&
			value.some(
				(item) =>
					!!item &&
					typeof item === "object" &&
					!Array.isArray(item) &&
					matches(item as Record<string, unknown>, record.$elemMatch as Record<string, unknown>)
			)
		);
	}
	return Object.entries(record).every(([key, nested]) =>
		matchCondition(
			value && typeof value === "object" && !Array.isArray(value)
				? (value as Record<string, unknown>)[key]
				: undefined,
			nested
		)
	);
}

function matches(row: Record<string, unknown>, filter: Record<string, unknown>): boolean {
	for (const [key, condition] of Object.entries(filter)) {
		if (key === "$or") {
			if (
				!Array.isArray(condition) ||
				!condition.some((candidate) =>
					matches(row, candidate as Record<string, unknown>)
				)
			) {
				return false;
			}
			continue;
		}
		if (!matchCondition(valueAt(row, key), condition)) {
			return false;
		}
	}
	return true;
}

describe("FOIL V4.1 report regressions", () => {
	it("reads propagation from PM events and never assumes propagation_queue", () => {
		for (const id of ["FOIL_PROPAGATION_PENDING", "FOIL_APPS_IMPACTED"]) {
			const definition = report(id);
			expect(definition.steps.every((step) => step.collection === "events")).toBe(true);
			expect(JSON.stringify(definition)).not.toContain("propagation_queue");
		}
	});

	it("distinguishes pending propagation from unassessed legacy events", () => {
		const definition = report("FOIL_PROPAGATION_PENDING");
		const pending = definition.steps.find((step) => step.id === "pending");
		const unassessed = definition.steps.find((step) => step.id === "unassessed");
		expect(pending?.filter).toBeDefined();
		expect(unassessed?.filter).toBeDefined();

		const pendingEvent = {
			_id: "EVT-PENDING",
			propagationStatus: "DEPENDENT_TARGETS_DIRTY",
			impactTargets: [{ target: "investor-app", state: "DIRTY" }]
		};
		const legacyEvent = {
			_id: "EVT-LEGACY",
			eventType: "SCIENTIST_ENGINEERING_CORRECTION",
			status: "CURRENT"
		};

		expect(matches(pendingEvent, pending!.filter!)).toBe(true);
		expect(matches(legacyEvent, pending!.filter!)).toBe(false);
		expect(matches(legacyEvent, unassessed!.filter!)).toBe(true);
	});

	it("matches the known Core conflict record", () => {
		const definition = report("FOIL_CONTRADICTIONS");
		const core = definition.steps.find((step) => step.id === "core-conflicts");
		expect(core?.collection).toBe("work_items");

		const fixture = {
			_id: "CONFLICT-WIND-DENSITY-001",
			kind: "conflict",
			area: "Wind farm density / wake",
			priority: "P0",
			status: "OPEN_VALIDATION"
		};
		expect(matches(fixture, core!.filter!)).toBe(true);
		expect(definition.steps.some((step) => step.sourceId === "FOIL_STUDY")).toBe(true);
	});

	it("surfaces a blocked P0 subtask inside a P0_P1 parent", () => {
		const rows = applyReportSemantics("FOIL_P0_BLOCKERS", "blockers", "backlog", [
			{
				_id: "BL-PARENT",
				priority: "P0_P1",
				status: "ACTIVE",
				title: "Parent",
				tasks: [
					{ id: "EA1", priority: "P0", status: "OPEN", label: "Open work" },
					{
						id: "EA3",
						priority: "P0",
						status: "BLOCKED_USER_PROJECT_UI_SYNC",
						label: "Blocked V4.1 UI sync",
						ownerAuthority: "FOIL Project Management"
					}
				]
			}
		]);
		expect(rows).toHaveLength(1);
		expect(rows[0].subtaskId).toBe("EA3");
		expect(rows[0].displayStatus).toBe("BLOCKED");
		expect(rows[0].parentBacklogRef).toBe("BL-PARENT");
	});

	it("does not return completed embedded tasks as executable next work", () => {
		const rows = applyReportSemantics("FOIL_NEXT", "backlog", "backlog", [
			{
				_id: "BL-CAO",
				priority: "P0",
				status: "QUALIFIED_AWAITING_USER_REVIEW",
				tasks: [
					{ id: "T1", status: "QUALIFIED_COMPLETE", label: "Already qualified" },
					{ id: "T9", status: "PENDING", label: "CAD backend" }
				]
			}
		]);
		expect(rows.some((row) => row.subtaskId === "T1")).toBe(false);
		expect(rows.some((row) => row.subtaskId === "T9")).toBe(true);
	});

	it("keeps recurring schedule null nextDueAt as unscheduled metadata", () => {
		const fixture = {
			_id: "BL-V4-WEEKLY-OPERATIONS-REVIEW",
			ownerAuthority: "FOIL Project Management",
			schedule: {
				type: "RECURRING",
				cadence: "WEEKLY",
				timing: "FLEXIBLE",
				nextDueAt: null,
				requiresSchedulingDecision: true
			}
		};
		const roundTrip = JSON.parse(JSON.stringify(fixture)) as typeof fixture;
		expect(roundTrip.schedule.type).toBe("RECURRING");
		expect(roundTrip.schedule.nextDueAt).toBeNull();
		expect(roundTrip.ownerAuthority).toBe("FOIL Project Management");

		const calendar = report("FOIL_CALENDAR");
		expect(JSON.stringify(calendar.steps[0].filter)).toContain("schedule");
	});

	it("rejects zero and negative query limits and caps large requests", () => {
		expect(() => normalizeReportLimit(0)).toThrow(/positive integer/);
		expect(() => normalizeReportLimit(-1)).toThrow(/positive integer/);
		expect(normalizeReportLimit(5000, 500, 500)).toEqual({
			requestedLimit: 5000,
			effectiveLimit: 500
		});
	});
});
