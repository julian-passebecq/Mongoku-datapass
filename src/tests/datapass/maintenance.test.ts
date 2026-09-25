import { describe, expect, it } from "vitest";
import { deriveMaintenance } from "$lib/datapass/maintenance";
import type { ReportSection, ReportSectionState } from "$lib/datapass/reporting";

const now = new Date("2026-09-25T12:00:00Z");

// Synthetic rows that mirror the live DATAPASSCONTROL field shapes observed on 2026-09-25.
const entities = [
	{
		entity_id: "tool_fresh",
		name: "Fresh tool",
		status: "merged_main_ci_green",
		lifecycle: "active",
		last_verified_at: "2026-09-24T23:20:00Z",
		updated_at: "2026-09-24",
		canonical_repo: "owner/tool",
		current_head: "aaaaaaa1111",
		ci_evidence: { result: "SUCCESS", head: "aaaaaaa1111" },
	},
	{
		entity_id: "tool_changed",
		name: "Changed tool",
		status: "active",
		lifecycle: "active",
		last_verified_at: "2026-09-23T10:00:00Z",
		updated_at: "2026-09-25",
		current_head: "bbbbbbb2222",
		ci_evidence: { result: "SUCCESS", head: "ccccccc3333" },
	},
	{ entity_id: "tool_stale", name: "Stale tool", status: "active", last_verified_at: "2026-08-01" },
	{ entity_id: "tool_never", name: "Never verified", status: "implemented", updated_at: "2026-09-22" },
	{ entity_id: "idea", name: "Idea", status: "planned", updated_at: "2026-09-22" },
	{
		entity_id: "old_domain",
		name: "Old domain",
		status: "stopped",
		lifecycle: "stopped",
		last_verified_at: "2025-01-01",
	},
	{ entity_id: "alias", name: "Alias", status: "retired_alias", alias_of: "tool_fresh" },
	{
		entity_id: "notes",
		name: "Notes app",
		status: "active",
		lifecycle: "active",
		last_verified_at: "2026-09-24T20:00:00Z",
		updated_at: "2026-09-24",
		mongoku_projection: { mode: "METADATA_ONLY", mongo_sync_status: "AWAITING_BOUNDED_OVERVIEW_EXPORT" },
	},
];

const repositories = [{ repo: "owner/tool", last_reviewed: "2026-09-25", active_head: "aaaaaaa1111" }];
const audits = [
	{
		audit_id: "AUDIT-1",
		audit_type: "portfolio",
		completed_at: "2026-09-24",
		status: "partial_complete",
		nextActions: 3,
	},
	{ audit_id: "AUDIT-2", audit_type: "repos", completed_at: "2026-09-22", status: "complete", nextActions: 0 },
];

function raw(
	id: string,
	sourceId: string,
	rows: Record<string, unknown>[],
	state: ReportSectionState = "OK",
): ReportSection {
	const resolved = ["OK", "EMPTY", "TRUNCATED"].includes(state);
	return {
		id,
		label: sourceId + " step",
		authority: sourceId,
		sourceId,
		rows: resolved ? rows : [],
		trace: {
			reportId: "MAINTENANCE",
			stepId: id,
			sourceId,
			authority: sourceId,
			resourceRef: sourceId,
			provider: "MONGODB_ATLAS",
			collection: "*",
			operation: id.startsWith("probe-") ? "inventory" : "find",
			readOnly: true,
			resolved,
			message: resolved ? undefined : "connect ECONNREFUSED",
		},
		meta: { state, returnedRows: rows.length, responseBytes: 0, truncated: false },
	};
}

function sections(options: { globalState?: ReportSectionState; probes?: Record<string, ReportSectionState> } = {}) {
	const global = options.globalState ?? "OK";
	const probes = { DATAPROJECTS_GLOBAL: global, FOIL_PM: "OK", FOIL_FABRIC: "OK", ...options.probes } as Record<
		string,
		ReportSectionState
	>;
	return [
		...Object.entries(probes).map(([sourceId, state]) =>
			raw("probe-" + sourceId.toLowerCase(), sourceId, [{ name: "a" }, { name: "b" }], state),
		),
		raw("organizations", "DATAPROJECTS_GLOBAL", [], global),
		raw("entities", "DATAPROJECTS_GLOBAL", entities, global),
		raw("repositories", "DATAPROJECTS_GLOBAL", repositories, global),
		raw("work", "DATAPROJECTS_GLOBAL", [], global),
		raw("audits", "DATAPROJECTS_GLOBAL", audits, global),
	];
}

const byId = (result: ReportSection[], id: string) => result.find((candidate) => candidate.id === id)!;
const row = (result: ReportSection[], sectionId: string, id: string) =>
	byId(result, sectionId).rows.find((candidate) => candidate._id === id)!;

describe("deriveMaintenance", () => {
	it("publishes only derived sections, never the raw steps", () => {
		const result = deriveMaintenance(sections(), now);
		expect(result.map((candidate) => candidate.id)).toEqual([
			"summary",
			"sources",
			"reconciliation",
			"projects",
			"heads",
			"projections",
			"audits",
		]);
		expect(JSON.stringify(result)).not.toContain("mongoku_projection");
	});

	it("keeps reachable apart from fresh", () => {
		const result = deriveMaintenance(sections(), now);
		expect(row(result, "sources", "FOIL_PM")).toMatchObject({
			availability: "reachable",
			collections: 2,
			actionKind: "none",
		});
		expect(row(result, "sources", "FOIL_PM").summary).toContain("says nothing about freshness");
	});

	it("names distinct actions for unbound, unregistered and unreachable sources", () => {
		const result = deriveMaintenance(
			sections({
				probes: { FOIL_FABRIC: "REGISTERED_UNBOUND", FOIL_PM: "REGISTRY_UNAVAILABLE", FOIL_CORE: "SOURCE_ERROR" },
			}),
			now,
		);
		expect(row(result, "sources", "FOIL_FABRIC")).toMatchObject({ availability: "unbound", actionKind: "bind_source" });
		expect(row(result, "sources", "FOIL_PM")).toMatchObject({
			availability: "registry_unavailable",
			actionKind: "fix_registry",
		});
		expect(row(result, "sources", "FOIL_CORE")).toMatchObject({
			availability: "unavailable",
			actionKind: "check_source",
		});
		// Other sections are unaffected by an unavailable optional source.
		expect(byId(result, "projects").trace.resolved).toBe(true);
		expect(byId(result, "projects").rows).toHaveLength(entities.length);
	});

	it("classifies project verification without treating inactive or unstarted work as stale", () => {
		const result = deriveMaintenance(sections(), now);
		expect(row(result, "projects", "tool_fresh")).toMatchObject({ freshness: "fresh", actionKind: "none" });
		expect(row(result, "projects", "tool_changed")).toMatchObject({ actionKind: "review_record" });
		expect(row(result, "projects", "tool_stale")).toMatchObject({ freshness: "stale", actionKind: "prepare_context" });
		expect(row(result, "projects", "tool_stale").nextAction).toContain("/?project=tool_stale");
		expect(row(result, "projects", "tool_never")).toMatchObject({ freshness: "unknown", actionKind: "verify" });
		expect(row(result, "projects", "idea")).toMatchObject({ lifecycleClass: "not_started", actionKind: "none" });
		expect(row(result, "projects", "old_domain")).toMatchObject({
			lifecycleClass: "inactive",
			freshness: "not_applicable",
			actionKind: "none",
		});
		expect(row(result, "projects", "alias")).toMatchObject({ lifecycleClass: "inactive" });
		expect(row(result, "projects", "tool_fresh").repoLastReviewed).toBe("2026-09-25");
	});

	it("compares calendar days as written, so a timezone offset does not invent a change", () => {
		const local = [
			{
				entity_id: "portfolio",
				status: "active",
				last_verified_at: "2026-09-25T00:50:00+02:00",
				updated_at: "2026-09-25",
			},
		];
		const input = sections().map((candidate) =>
			candidate.id === "entities" ? { ...candidate, rows: local } : candidate,
		);
		expect(row(deriveMaintenance(input, now), "projects", "portfolio")).toMatchObject({ actionKind: "none" });
	});

	it("sorts rows so the most urgent action comes first", () => {
		const kinds = deriveMaintenance(sections(), now)
			.find((candidate) => candidate.id === "projects")!
			.rows.map((candidate) => candidate.actionKind);
		expect(kinds.slice(0, 3)).toEqual(["prepare_context", "verify", "review_record"]);
		expect(kinds.at(-1)).toBe("none");
	});

	it("compares recorded heads only, and flags CI evidence for another head", () => {
		const result = deriveMaintenance(sections(), now);
		expect(row(result, "heads", "tool_fresh")).toMatchObject({ consistent: true, actionKind: "none" });
		expect(row(result, "heads", "tool_changed")).toMatchObject({ consistent: false, actionKind: "reconcile" });
		expect(row(result, "heads", "tool_fresh").summary).toContain("GitHub itself is not read");
		expect(byId(result, "heads").rows).toHaveLength(2);
	});

	it("reports an awaited projection as not published, never with invented counts", () => {
		const projection = row(deriveMaintenance(sections(), now), "projections", "notes");
		expect(projection).toMatchObject({
			availability: "not_published",
			recordedSyncStatus: "AWAITING_BOUNDED_OVERVIEW_EXPORT",
			counts: null,
			actionKind: "export_projection",
		});
	});

	it("flags partial audits and leaves completed ones alone", () => {
		const result = deriveMaintenance(sections(), now);
		expect(row(result, "audits", "AUDIT-1")).toMatchObject({ actionKind: "review_audit", recordedNextActions: 3 });
		expect(row(result, "audits", "AUDIT-2")).toMatchObject({ actionKind: "none" });
	});

	it("summarises counts, claims no backup and names the first action", () => {
		const summary = byId(deriveMaintenance(sections(), now), "summary").rows[0];
		expect(summary).toMatchObject({
			sourcesReachable: "3/3",
			globalGraph: "readable",
			projectsNeedingAction: 3,
			headsToReconcile: 1,
			auditsToReview: 1,
			projectionsNeedingAction: 1,
			backups: "NOT_RECORDED",
			actionKind: "reconcile",
		});
		expect(summary.nextAction).toBe("Changed tool: Record CI evidence for the current head");
	});

	it("leaves project sections empty and unresolved when DATAPASSCONTROL is down", () => {
		const result = deriveMaintenance(sections({ globalState: "SOURCE_ERROR" }), now);
		for (const id of ["reconciliation", "projects", "heads", "projections", "audits"]) {
			expect(byId(result, id).trace.resolved, id).toBe(false);
			expect(byId(result, id).rows, id).toEqual([]);
		}
		expect(byId(result, "sources").trace.resolved).toBe(true);
		expect(row(result, "sources", "FOIL_PM").availability).toBe("reachable");
		expect(byId(result, "summary").rows[0]).toMatchObject({ globalGraph: "unavailable", sourcesReachable: "2/3" });
	});
});
