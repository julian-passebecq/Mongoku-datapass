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

export function normalizeWorkStatus(value: unknown): DisplayStatus {
	const raw = valueText(value).trim().toUpperCase();
	if (!raw) {
		return "UNKNOWN";
	}
	if (/QUALIFIED_COMPLETE|COMPLETE|COMPLETED|DONE|CLOSED|RESOLVED|VERIFIED|RECONCILED/.test(raw)) {
		return "DONE";
	}
	if (/BLOCK/.test(raw)) {
		return "BLOCKED";
	}
	if (/WAIT|EXTERNAL|BUSINESS|USER|FRANCIS/.test(raw)) {
		return "WAITING_EXTERNAL";
	}
	if (/VERIFY|VALIDAT|REVIEW|QUALIFIED|PRETEST/.test(raw)) {
		return "VERIFY";
	}
	if (/DEFER|FROZEN|HOLD/.test(raw)) {
		return "DEFERRED";
	}
	if (/ACTIVE|PROGRESS|DOING|IMPLEMENT|CURRENT/.test(raw)) {
		return "ACTIVE";
	}
	if (/READY|OPEN|TODO|NEXT|PENDING/.test(raw)) {
		return "READY";
	}
	if (/BACKLOG|DRAFT|PLANNED/.test(raw)) {
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
		displayStatus: normalizeWorkStatus(rawStatus)
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
				completedAt: task.completedAt
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
	rows: Record<string, unknown>[]
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
