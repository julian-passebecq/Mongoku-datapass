<script lang="ts">
	import type { ReportResult } from "$lib/datapass/reporting";

	let { data } = $props();
	const report = $derived(data.report as ReportResult);
	const rows = $derived(report.sections.flatMap((section) => section.rows));

	function text(row: Record<string, unknown>, key: string): string {
		const value = row[key];
		return value == null ? "" : String(value);
	}

	function nestedText(row: Record<string, unknown>, objectKey: string, key: string): string {
		const value = row[objectKey];
		if (!value || typeof value !== "object" || Array.isArray(value)) {
			return "";
		}
		const nested = (value as Record<string, unknown>)[key];
		return nested == null ? "" : String(nested);
	}

	function dateOf(row: Record<string, unknown>): string {
		return (
			text(row, "nextDueAt") ||
			text(row, "nextReviewAt") ||
			text(row, "targetReviewDate") ||
			nestedText(row, "schedule", "nextDueAt") ||
			"Unscheduled"
		);
	}

	const grouped = $derived.by(() => {
		const groups = new Map<string, Record<string, unknown>[]>();
		for (const row of rows) {
			const key = dateOf(row);
			const existing = groups.get(key) ?? [];
			existing.push(row);
			groups.set(key, existing);
		}
		return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
	});
</script>

<section class="space-y-6">
	<div>
		<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">FOIL governance calendar</p>
		<h1 class="mt-2 text-3xl font-semibold tracking-tight">Reviews, maintenance & due work</h1>
		<p class="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">
			Supports one-off, recurring and condition-review scheduling contracts. This page never invokes External Audit or
			Self-Audit automatically.
		</p>
	</div>

	<div class="grid gap-3 md:grid-cols-3">
		<div class="rounded-xl border border-[var(--border-color)] p-4">
			<p class="text-[10px] uppercase text-[var(--text-muted)]">ONE_OFF</p>
			<p class="mt-2 text-xs">Explicit due/review date.</p>
		</div>
		<div class="rounded-xl border border-[var(--border-color)] p-4">
			<p class="text-[10px] uppercase text-[var(--text-muted)]">RECURRING</p>
			<p class="mt-2 text-xs">RRULE / cadence with next due state.</p>
		</div>
		<div class="rounded-xl border border-[var(--border-color)] p-4">
			<p class="text-[10px] uppercase text-[var(--text-muted)]">CONDITION_REVIEW</p>
			<p class="mt-2 text-xs">Review trigger only; no automatic audit execution.</p>
		</div>
	</div>

	{#each report.sections.filter((section) => !section.trace.resolved) as section}
		<div class="rounded-xl border border-dashed border-[var(--border-color)] p-4 text-xs text-[var(--text-muted)]">
			{section.label}: {section.trace.message}
		</div>
	{/each}

	<div class="grid gap-4 xl:grid-cols-2">
		{#each grouped as [date, items]}
			<section class="rounded-xl border border-[var(--border-color)]">
				<div class="border-b border-[var(--border-color)] px-4 py-3">
					<h2 class="text-sm font-semibold">{date}</h2>
				</div>
				<div class="divide-y divide-[var(--border-color)]">
					{#each items as row}
						<div class="px-4 py-3">
							<div class="flex items-start justify-between gap-3">
								<div>
									<p class="text-sm font-medium">{text(row, "title") || text(row, "name") || text(row, "_id")}</p>
									<p class="mt-1 text-[11px] text-[var(--text-muted)]">
										{text(row, "nextAction") || text(row, "currentStep")}
									</p>
								</div>
								<span class="text-[10px]">{text(row, "priority")}</span>
							</div>
							<p class="mt-2 text-[10px] text-[var(--text-muted)]">
								Owner authority: {text(row, "ownerAuthority") ||
									nestedText(row, "schedule", "ownerAuthority") ||
									text(row, "authority") ||
									"FOIL Project Management"}
							</p>
							<p class="mt-1 text-[10px] text-[var(--text-muted)]">
								Schedule: {nestedText(row, "schedule", "type") || text(row, "scheduleType") || "ONE_OFF"}
								· Last completed: {text(row, "lastCompletedAt") ||
									nestedText(row, "schedule", "lastCompletedAt") ||
									"—"}
							</p>
							{#if text(row, "recurrence") || nestedText(row, "schedule", "recurrence") || nestedText(row, "schedule", "rrule")}
								<p class="mt-1 font-mono text-[9px] text-[var(--text-muted)]">
									{text(row, "recurrence") ||
										nestedText(row, "schedule", "recurrence") ||
										nestedText(row, "schedule", "rrule")}
								</p>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{:else}
			<div class="rounded-xl border border-dashed border-[var(--border-color)] p-6 text-sm text-[var(--text-muted)]">
				No scheduled FOIL items returned.
			</div>
		{/each}
	</div>
</section>
