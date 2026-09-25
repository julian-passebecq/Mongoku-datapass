export function normalizeReportLimit(
	requested: number | undefined,
	defaultLimit = 500,
	maxLimit = 500,
): { requestedLimit: number; effectiveLimit: number } {
	const requestedLimit = requested ?? defaultLimit;
	if (!Number.isInteger(requestedLimit) || requestedLimit <= 0) {
		throw new Error("Report query limit must be a positive integer");
	}
	return {
		requestedLimit,
		effectiveLimit: Math.min(requestedLimit, maxLimit),
	};
}

export type DisplayStatus =
	| "BACKLOG"
	| "READY"
	| "ACTIVE"
	| "BLOCKED"
	| "WAITING_EXTERNAL"
	| "VERIFY"
	| "DEFERRED"
	| "DONE"
	| "UNKNOWN";

function valueText(value: unknown): string {
	return value == null ? "" : String(value);
}

/**
 * Splits a raw status such as `partial_green` or `WAITING_FRANCIS` into lowercase tokens so
 * normalization matches whole words instead of substrings (`incomplete` must not read as `complete`,
 * `unblocked` must not read as `blocked`).
 */
function statusTokens(raw: string): string[] {
	return raw
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter(Boolean);
}

/** Qualifiers that mean a positive-looking status is not actually reached (`not_deployed`, `partial_green`). */
const UNFINISHED_TOKENS = ["not", "partial", "partially", "unverified", "incomplete", "unresolved"];
const DONE_TOKENS = [
	"done",
	"complete",
	"completed",
	"closed",
	"resolved",
	"verified",
	"reconciled",
	"green",
	"mitigated",
];
const BLOCKED_TOKENS = ["blocked", "blocker", "blocking"];
const WAITING_TOKENS = ["waiting", "awaiting", "wait", "external", "business", "user", "francis"];
const VERIFY_TOKENS = [
	"verify",
	"validation",
	"validate",
	"validating",
	"review",
	"qualified",
	"qualification",
	"pretest",
	"audit",
	"classify",
	"proven",
];
/** Deliberately parked or stopped: not failed, not active (FOIL Hydro is `stopped`). */
const DEFERRED_TOKENS = [
	"defer",
	"deferred",
	"frozen",
	"hold",
	"paused",
	"stopped",
	"retired",
	"archived",
	"cancelled",
	"canceled",
];
/** Kept only as reference material; an explicit active qualifier (`active_donor`) wins. */
const REFERENCE_TOKENS = ["donor", "reference", "legacy"];
const ACTIVE_TOKENS = [
	"active",
	"progress",
	"doing",
	"implement",
	"implemented",
	"current",
	"ongoing",
	"deployed",
	"prototype",
];
const READY_TOKENS = ["ready", "open", "todo", "next", "pending"];
const BACKLOG_TOKENS = ["backlog", "draft", "planned", "candidate", "proposed"];

export function normalizeWorkStatus(value: unknown): DisplayStatus {
	const tokens = statusTokens(valueText(value));
	if (tokens.length === 0) {
		return "UNKNOWN";
	}
	const has = (candidates: readonly string[]) => tokens.some((token) => candidates.includes(token));
	const unfinished = has(UNFINISHED_TOKENS);

	if (has(DONE_TOKENS)) {
		// `partial_green`, `not_verified`: the positive state is claimed but not reached yet.
		return unfinished ? "VERIFY" : "DONE";
	}
	if (has(BLOCKED_TOKENS)) {
		return "BLOCKED";
	}
	if (has(WAITING_TOKENS)) {
		return "WAITING_EXTERNAL";
	}
	if (has(VERIFY_TOKENS)) {
		return "VERIFY";
	}
	if (has(DEFERRED_TOKENS)) {
		return "DEFERRED";
	}
	if (!unfinished && has(ACTIVE_TOKENS)) {
		return "ACTIVE";
	}
	if (has(REFERENCE_TOKENS)) {
		return "DEFERRED";
	}
	if (has(READY_TOKENS)) {
		return "READY";
	}
	if (has(BACKLOG_TOKENS)) {
		return "BACKLOG";
	}
	return "UNKNOWN";
}

function withStatus(row: Record<string, unknown>): Record<string, unknown> {
	const rawStatus = valueText(row.rawStatus || row.status);
	if (!rawStatus) {
		return { ...row };
	}
	return {
		...row,
		rawStatus,
		displayStatus: normalizeWorkStatus(rawStatus),
	};
}

function taskRows(parent: Record<string, unknown>): Record<string, unknown>[] {
	if (!Array.isArray(parent.tasks)) {
		return [];
	}
	const parentId = valueText(parent._id || parent.id);
	return parent.tasks
		.filter((task): task is Record<string, unknown> => !!task && typeof task === "object" && !Array.isArray(task))
		.map((task, index) => {
			const taskId = valueText(task.id) || String(index + 1);
			const rawStatus = valueText(task.status);
			return withStatus({
				...parent,
				tasks: undefined,
				_id: parentId + "::" + taskId,
				parentBacklogRef: parentId,
				backlogRef: valueText(task.backlogRef) || parentId,
				subtaskId: taskId,
				isEmbeddedTask: true,
				title: valueText(task.label) || valueText(task.title) || valueText(parent.title),
				status: rawStatus || parent.status,
				rawStatus: rawStatus || parent.status,
				priority: task.priority ?? parent.priority,
				ownerAuthority: task.ownerAuthority ?? parent.ownerAuthority,
				completedAt: task.completedAt,
			});
		});
}

function priorityStartsP0(row: Record<string, unknown>): boolean {
	return /^P0(?:_|$)/i.test(valueText(row.priority));
}

function isOpen(row: Record<string, unknown>): boolean {
	return normalizeWorkStatus(row.rawStatus ?? row.status) !== "DONE";
}

function isCriticalBlocked(row: Record<string, unknown>): boolean {
	const status = normalizeWorkStatus(row.rawStatus ?? row.status);
	return priorityStartsP0(row) && (status === "BLOCKED" || status === "WAITING_EXTERNAL");
}

function uniqueRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
	const seen = new Set<string>();
	return rows.filter((row, index) => {
		const key = valueText(row._id || row.id) || "row-" + index;
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}

export function applyReportSemantics(
	reportId: string,
	stepId: string,
	collection: string,
	rows: Record<string, unknown>[],
): Record<string, unknown>[] {
	const normalized = rows.map(withStatus);
	if (collection !== "backlog") {
		return normalized;
	}

	const embedded = rows.flatMap(taskRows);
	const combined = uniqueRows([...normalized, ...embedded]);

	if (reportId === "FOIL_P0_BLOCKERS") {
		return combined.filter(isCriticalBlocked);
	}
	if (reportId === "FOIL_STATUS_NOW" && stepId === "p0") {
		return combined.filter((row) => priorityStartsP0(row) && isOpen(row));
	}
	if (reportId === "FOIL_NEXT") {
		return combined.filter(isOpen);
	}
	if (reportId === "FOIL_MAINTENANCE_DUE") {
		return normalized.filter(isOpen);
	}
	return normalized;
}
