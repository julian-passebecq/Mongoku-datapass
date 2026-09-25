/**
 * MAINTENANCE report derivation: turns the raw read-only steps of the report (one reachability
 * probe per catalog source, plus bounded DATAPASSCONTROL reads) into small rows that each name
 * the smallest next action. Pure: no I/O, no writes, and nothing is inferred beyond the recorded
 * metadata. See docs/GALAXY_PROJECTION_CONTRACT_2026-09-25.md.
 *
 * States stay distinct: reachable is not fresh, verified is not reviewed, inactive is not stale,
 * and backups are reported as not recorded because no bound source records them.
 */
import {
	freshnessOf,
	isDoneStatus,
	isInactiveStatus,
	reconciliationFindings,
	statusTokens,
	text,
	timeOf,
} from "./cockpit";
import { assessProjection } from "./projection";
import type { ReportSection, ReportSectionState, ReportSourceTrace } from "./reporting";

type Row = Record<string, unknown>;

export type MaintenanceActionKind =
	| "none"
	| "bind_source"
	| "fix_registry"
	| "check_source"
	| "verify"
	| "prepare_context"
	| "review_record"
	| "reconcile"
	| "review_audit"
	| "export_projection"
	| "refresh_projection"
	| "review_snapshot"
	| "open_source"
	| "back_up";

export const MAINTENANCE_STEP_IDS = {
	probePrefix: "probe-",
	organizations: "organizations",
	entities: "entities",
	repositories: "repositories",
	work: "work",
	audits: "audits",
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Not started yet: nothing to verify, so a missing verification is not a finding. */
const DORMANT_TOKENS = ["planned", "proposed", "candidate", "reference", "donor"];
const REACHABLE_STATES: ReportSectionState[] = ["OK", "EMPTY", "TRUNCATED"];

// Lower rank = more urgent. Rows are sorted by it so the first row is the next thing to do.
const ACTION_RANK: Record<MaintenanceActionKind, number> = {
	check_source: 0,
	fix_registry: 1,
	bind_source: 2,
	reconcile: 3,
	prepare_context: 4,
	verify: 5,
	review_record: 6,
	refresh_projection: 7,
	review_snapshot: 8,
	review_audit: 9,
	back_up: 10,
	open_source: 11,
	export_projection: 12,
	none: 99,
};

function action(
	kind: MaintenanceActionKind,
	nextAction: string,
): { actionKind: MaintenanceActionKind; nextAction: string } {
	return { actionKind: kind, nextAction };
}

function byAction(a: Row, b: Row): number {
	return ACTION_RANK[a.actionKind as MaintenanceActionKind] - ACTION_RANK[b.actionKind as MaintenanceActionKind];
}

function ageDays(value: string | undefined, now: Date): number | undefined {
	const time = timeOf(value);
	return Number.isFinite(time) ? Math.max(0, Math.floor((now.getTime() - time) / DAY_MS)) : undefined;
}

/**
 * The calendar day as written by the source. `updated_at` is a bare local date, so converting
 * `2026-09-25T00:50:00+02:00` to UTC (2026-09-24) would invent a change after verification.
 */
function dayOf(value: string | undefined): string | undefined {
	return value && Number.isFinite(timeOf(value)) && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : undefined;
}

function short(head: string | undefined): string {
	return head ? head.slice(0, 7) : "";
}

function record(row: Row | undefined, key: string): Row | undefined {
	const value = row?.[key];
	return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : undefined;
}

function optional(row: Row | undefined, key: string): string | undefined {
	return text(row, key) || undefined;
}

function hasAnyToken(raw: string, tokens: string[]): boolean {
	return statusTokens(raw).some((token) => tokens.includes(token));
}

function derivedTrace(stepId: string, base: ReportSourceTrace | undefined, resolved: boolean): ReportSourceTrace {
	return {
		reportId: "MAINTENANCE",
		stepId,
		sourceId: base?.sourceId ?? "DERIVED",
		authority: base?.authority ?? "Mongoku (derived from read-only steps)",
		resourceRef: base?.resourceRef ?? "derived",
		provider: base?.provider ?? "MONGODB_ATLAS",
		database: base?.database,
		collection: base?.collection ?? "*",
		operation: base?.operation ?? "find",
		readOnly: true,
		resolved,
		resourceRegistry: base?.resourceRegistry,
		message: resolved ? undefined : (base?.message ?? "DATAPASSCONTROL is unavailable; nothing is substituted."),
	};
}

function section(id: string, label: string, authority: string, trace: ReportSourceTrace, rows: Row[]): ReportSection {
	const resolved = trace.resolved;
	return {
		id,
		label,
		authority,
		sourceId: trace.sourceId,
		rows,
		trace,
		meta: {
			state: resolved ? (rows.length === 0 ? "EMPTY" : "OK") : "SOURCE_ERROR",
			returnedRows: rows.length,
			responseBytes: new TextEncoder().encode(JSON.stringify(rows)).byteLength,
			truncated: false,
		},
	};
}

function sourceRows(probes: ReportSection[]): Row[] {
	return probes.map((probe) => {
		const state = probe.meta?.state ?? (probe.trace.resolved ? "OK" : "SOURCE_ERROR");
		const reachable = probe.trace.resolved && REACHABLE_STATES.includes(state);
		const base = {
			_id: probe.sourceId,
			title: probe.label,
			sourceId: probe.sourceId,
			state,
			collections: reachable ? probe.rows.length : null,
			registryVerifiedAt: probe.trace.resourceRegistry?.lastVerifiedAt ?? null,
		};
		if (reachable) {
			return {
				...base,
				availability: "reachable",
				summary: "Reachable · " + probe.rows.length + " collection(s). Reachable says nothing about freshness.",
				...action("none", "No action"),
			};
		}
		if (state === "SOURCE_UNBOUND" || state === "REGISTERED_UNBOUND") {
			return {
				...base,
				availability: "unbound",
				summary: "No server binding is configured for this source.",
				...action("bind_source", "Bind it only if Mongoku should read it (DATAPASS_SOURCE_BINDINGS)"),
			};
		}
		if (state === "REGISTRY_UNAVAILABLE") {
			return {
				...base,
				availability: "registry_unavailable",
				summary: "The FOIL PM resource_registry record is missing or ambiguous.",
				...action("fix_registry", "Fix the resource_registry record in FOIL PM (see SOURCE_INVENTORY trace)"),
			};
		}
		return {
			...base,
			availability: "unavailable",
			summary: "Bound but unreadable; nothing is substituted.",
			...action("check_source", "Check network access and the read-only user (see SOURCE_INVENTORY trace)"),
		};
	});
}

function projectRows(entities: Row[], repositories: Row[], now: Date): Row[] {
	return entities
		.filter((entity) => text(entity, "entity_id"))
		.map((entity) => {
			const id = text(entity, "entity_id");
			const status = text(entity, "status");
			const lifecycle = text(entity, "lifecycle");
			const verifiedAt = optional(entity, "last_verified_at");
			const updatedAt = optional(entity, "updated_at");
			const repo = optional(entity, "canonical_repo");
			const repository = repo ? repositories.find((row) => text(row, "repo") === repo) : undefined;
			const base = {
				_id: id,
				title: text(entity, "name") || id,
				entityId: id,
				status,
				lifecycle: lifecycle || null,
				lastVerifiedAt: verifiedAt ?? null,
				verifiedAgeDays: ageDays(verifiedAt, now) ?? null,
				recordUpdatedAt: updatedAt ?? null,
				repo: repo ?? null,
				repoLastReviewed: optional(repository, "last_reviewed") ?? null,
				openUri: "/?project=" + encodeURIComponent(id),
			};

			if (isInactiveStatus(status) || isInactiveStatus(lifecycle) || text(entity, "alias_of")) {
				return {
					...base,
					lifecycleClass: "inactive",
					freshness: "not_applicable",
					summary: "Inactive (" + status + "); kept as history.",
					...action("none", "No refresh expected"),
				};
			}
			if (hasAnyToken(status + " " + lifecycle, DORMANT_TOKENS)) {
				return {
					...base,
					lifecycleClass: "not_started",
					freshness: "not_applicable",
					summary: "Not started (" + status + "); nothing to verify yet.",
					...action("none", "No action until work starts"),
				};
			}

			const freshness = freshnessOf([verifiedAt], now);
			const common = { ...base, lifecycleClass: "active", freshness };
			if (freshness === "unknown") {
				return {
					...common,
					summary: "Active but never verified (no last_verified_at).",
					...action("verify", "Record a verification at the next review"),
				};
			}
			if (freshness === "stale") {
				return {
					...common,
					summary: "Last verified " + base.verifiedAgeDays + " days ago.",
					...action("prepare_context", "Prepare a bounded context (" + base.openUri + ") and re-verify"),
				};
			}
			const verifiedDay = dayOf(verifiedAt);
			const updatedDay = dayOf(updatedAt);
			if (verifiedDay && updatedDay && updatedDay > verifiedDay) {
				return {
					...common,
					summary: "Record changed on " + updatedDay + ", after its last verification on " + verifiedDay + ".",
					...action("review_record", "Re-verify the changed record"),
				};
			}
			return {
				...common,
				summary: "Verified " + base.verifiedAgeDays + " day(s) ago (" + freshness + ").",
				...action("none", "No action"),
			};
		})
		.sort(byAction);
}

function headRows(entities: Row[], repositories: Row[]): Row[] {
	const rows: Row[] = [];
	for (const entity of entities) {
		const id = text(entity, "entity_id");
		const recorded = optional(entity, "current_head") ?? optional(entity, "current_repo_head");
		const ciHead = optional(record(entity, "ci_evidence"), "head");
		const repo = optional(entity, "canonical_repo");
		const repository = repo ? repositories.find((row) => text(row, "repo") === repo) : undefined;
		const repoHead = optional(repository, "active_head");
		if (!recorded && !ciHead && !repoHead) {
			continue;
		}
		const base = {
			_id: id,
			title: text(entity, "name") || id,
			entityId: id,
			repo: repo ?? null,
			recordedHead: recorded ?? null,
			ciHead: ciHead ?? null,
			ciResult: optional(record(entity, "ci_evidence"), "result") ?? null,
			repoHead: repoHead ?? null,
			codeHead: optional(entity, "code_head") ?? null,
			repoLastReviewed: optional(repository, "last_reviewed") ?? null,
		};
		if (recorded && ciHead && recorded !== ciHead) {
			rows.push({
				...base,
				consistent: false,
				summary: "CI evidence is for " + short(ciHead) + ", the recorded head is " + short(recorded) + ".",
				...action("reconcile", "Record CI evidence for the current head"),
			});
		} else if (recorded && repoHead && recorded !== repoHead) {
			rows.push({
				...base,
				consistent: false,
				summary: "Entity records " + short(recorded) + ", repository row records " + short(repoHead) + ".",
				...action("reconcile", "Reconcile the entity and repository records"),
			});
		} else {
			rows.push({
				...base,
				consistent: true,
				summary: "Recorded heads agree (" + short(recorded ?? repoHead ?? ciHead) + "). GitHub itself is not read.",
				...action("none", "No action"),
			});
		}
	}
	return rows.sort(byAction);
}

function auditRows(audits: Row[], now: Date): Row[] {
	return audits
		.map((audit) => {
			const id = text(audit, "audit_id") || text(audit, "_id");
			const status = text(audit, "status");
			const completedAt = optional(audit, "completed_at");
			const nextActions = typeof audit.nextActions === "number" ? audit.nextActions : 0;
			const base = {
				_id: id,
				title: id + (text(audit, "audit_type") ? " · " + text(audit, "audit_type") : ""),
				status,
				completedAt: completedAt ?? null,
				ageDays: ageDays(completedAt, now) ?? null,
				recordedNextActions: nextActions,
				recordedLimitations: typeof audit.limitations === "number" ? audit.limitations : 0,
			};
			if (!completedAt) {
				return {
					...base,
					summary: "No completion date recorded.",
					...action("review_audit", "Check whether it finished"),
				};
			}
			if (!isDoneStatus(status)) {
				return {
					...base,
					summary: "Completed " + completedAt + " as " + status + ", with " + nextActions + " recorded next action(s).",
					...action("review_audit", "Review its recorded next actions and coverage"),
				};
			}
			return { ...base, summary: "Completed " + completedAt + " (" + status + ").", ...action("none", "No action") };
		})
		.sort(byAction);
}

function projectionRows(entities: Row[], now: Date): Row[] {
	return entities
		.map((entity) => ({ entity, projection: record(entity, "mongoku_projection") }))
		.filter((candidate): candidate is { entity: Row; projection: Row } => !!candidate.projection)
		.map(({ entity, projection }) => {
			const id = text(entity, "entity_id");
			const assessment = assessProjection({
				now,
				enabled: !/^DISABLED$/i.test(text(projection, "mode")),
				// The published envelope, once an upstream exports one; see the projection contract.
				raw: projection.envelope,
			});
			return {
				_id: id,
				title: (text(entity, "name") || id) + " projection",
				entityId: id,
				mode: optional(projection, "mode") ?? null,
				recordedSyncStatus: optional(projection, "mongo_sync_status") ?? null,
				availability: assessment.availability,
				freshness: assessment.freshness,
				reviewed: assessment.reviewed,
				format: assessment.projection?.format ?? null,
				generatedAt: assessment.projection?.generatedAt ?? null,
				counts: assessment.projection?.counts ?? null,
				issues: assessment.issues,
				summary: "Projection " + assessment.availability + " (" + assessment.freshness + ").",
				...action(assessment.nextAction.kind, assessment.nextAction.label),
			};
		})
		.sort(byAction);
}

function reconciliationRows(organizations: Row[], entities: Row[], work: Row[]): Row[] {
	return reconciliationFindings(organizations, entities, work).map((finding) => ({
		_id: finding.id,
		title: finding.title,
		severity: finding.severity,
		summary: finding.detail,
		refs: finding.refs,
		...action("reconcile", "Review the source data; Mongoku does not auto-fix"),
	}));
}

/**
 * Replaces the raw MAINTENANCE steps with derived sections. Raw entity/repository rows never
 * leave the server through this report: only the derived, bounded rows do.
 */
export function deriveMaintenance(raw: ReportSection[], now: Date): ReportSection[] {
	const byId = new Map(raw.map((candidate) => [candidate.id, candidate]));
	const probes = raw.filter((candidate) => candidate.id.startsWith(MAINTENANCE_STEP_IDS.probePrefix));
	const entitiesSection = byId.get(MAINTENANCE_STEP_IDS.entities);
	const globalReadable = !!entitiesSection?.trace.resolved;
	const rowsOf = (id: string) => (byId.get(id)?.trace.resolved ? (byId.get(id)?.rows ?? []) : []);

	const entities = rowsOf(MAINTENANCE_STEP_IDS.entities);
	const repositories = rowsOf(MAINTENANCE_STEP_IDS.repositories);
	const globalTrace = (stepId: string, sourceStep: string = MAINTENANCE_STEP_IDS.entities) => {
		const base = byId.get(sourceStep)?.trace ?? entitiesSection?.trace;
		return derivedTrace(stepId, base, globalReadable && !!base?.resolved);
	};

	const sources = sourceRows(probes);
	const projects = globalReadable ? projectRows(entities, repositories, now) : [];
	const heads = globalReadable ? headRows(entities, repositories) : [];
	const auditsTrace = globalTrace("audits", MAINTENANCE_STEP_IDS.audits);
	const audits = auditsTrace.resolved ? auditRows(rowsOf(MAINTENANCE_STEP_IDS.audits), now) : [];
	const projections = globalReadable ? projectionRows(entities, now) : [];
	const reconciliation = globalReadable
		? reconciliationRows(rowsOf(MAINTENANCE_STEP_IDS.organizations), entities, rowsOf(MAINTENANCE_STEP_IDS.work))
		: [];

	const needsAction = (rows: Row[]) => rows.filter((row) => row.actionKind !== "none").length;
	const reachable = sources.filter((row) => row.availability === "reachable").length;
	const firstAction = [...sources, ...reconciliation, ...projects, ...heads, ...projections, ...audits]
		.filter((row) => row.actionKind !== "none")
		.sort(byAction)[0];
	const summary: Row = {
		_id: "summary",
		title: "Maintenance summary",
		sourcesReachable: reachable + "/" + sources.length,
		globalGraph: globalReadable ? "readable" : "unavailable",
		projectsNeedingAction: needsAction(projects),
		headsToReconcile: needsAction(heads),
		auditsToReview: needsAction(audits),
		projectionsNeedingAction: needsAction(projections),
		reconciliationFindings: reconciliation.length,
		backups: "NOT_RECORDED",
		summary:
			reachable +
			"/" +
			sources.length +
			" sources reachable; " +
			(globalReadable
				? needsAction(projects) +
					" project(s), " +
					needsAction(heads) +
					" head record(s), " +
					needsAction(audits) +
					" audit(s) and " +
					reconciliation.length +
					" reconciliation finding(s) need attention. Backup state is not recorded in any bound source."
				: "DATAPASSCONTROL unavailable, so project sections are empty rather than guessed."),
		...(firstAction
			? action(firstAction.actionKind as MaintenanceActionKind, firstAction.title + ": " + firstAction.nextAction)
			: action("none", "Nothing needs attention")),
	};

	const authority = "DATAPASSCONTROL (derived by Mongoku)";
	return [
		section("summary", "Summary", "Mongoku (derived)", derivedTrace("summary", undefined, true), [summary]),
		section(
			"sources",
			"Source reachability",
			"Every catalog source",
			derivedTrace("sources", undefined, true),
			sources,
		),
		section("reconciliation", "Needs reconciliation", authority, globalTrace("reconciliation"), reconciliation),
		section("projects", "Project verification freshness", authority, globalTrace("projects"), projects),
		section("heads", "Recorded heads (GitHub not read)", authority, globalTrace("heads"), heads),
		section("projections", "Galaxy projections", authority, globalTrace("projections"), projections),
		section("audits", "Audit runs", authority, auditsTrace, audits),
	];
}
