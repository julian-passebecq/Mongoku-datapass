<script lang="ts">
	import type { ReportResult } from "$lib/datapass/reporting";

	let { data } = $props();
	const report = $derived(data.report as ReportResult);
	const rows = $derived(report.sections.flatMap((section) => section.rows));
	const trace = $derived(report.sections[0]?.trace);

	const columns = ["BACKLOG", "READY", "ACTIVE", "BLOCKED", "WAITING_EXTERNAL", "VERIFY", "DEFERRED", "DONE"] as const;

	function text(row: Record<string, unknown>, key: string): string {
		const value = row[key];
		return value == null ? "" : String(value);
	}

	function list(row: Record<string, unknown>, key: string): unknown[] {
		return Array.isArray(row[key]) ? (row[key] as unknown[]) : [];
	}

	function column(row: Record<string, unknown>): (typeof columns)[number] {
		const status = text(row, "status").toUpperCase();
		if (/DONE|CLOSED|RESOLVED|COMPLETE/.test(status)) {
			return "DONE";
		}
		if (/DEFER|FROZEN|HOLD/.test(status)) {
			return "DEFERRED";
		}
		if (/BLOCK/.test(status)) {
			return "BLOCKED";
		}
		if (/WAIT|EXTERNAL|BUSINESS|USER/.test(status)) {
			return "WAITING_EXTERNAL";
		}
		if (/VERIFY|REVIEW|QUALIFIED|PRETEST/.test(status)) {
			return "VERIFY";
		}
		if (/ACTIVE|PROGRESS|DOING|IMPLEMENT/.test(status)) {
			return "ACTIVE";
		}
		if (/READY|OPEN|TODO|NEXT/.test(status)) {
			return "READY";
		}
		return "BACKLOG";
	}

	function impactCount(row: Record<string, unknown>): number {
		return list(row, "impactTargets").length + list(row, "relatedAuthorities").length;
	}
</script>

<section class="space-y-6">
	<div>
		<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">FOIL · Project Management</p>
		<h1 class="mt-2 text-3xl font-semibold tracking-tight">Authoritative backlog Kanban</h1>
		<p class="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">
			This board is a read-only view over <code>foil_project_management.backlog</code>. Cards are not copied into
			Mongoku work_items.
		</p>
	</div>

	{#if trace && !trace.resolved}
		<div class="rounded-xl border border-dashed border-[var(--border-color)] p-5 text-sm text-[var(--text-muted)]">
			{trace.message}
		</div>
	{/if}

	<div class="overflow-x-auto pb-4">
		<div class="grid min-w-[1760px] grid-cols-8 gap-3">
			{#each columns as status, __eachIndex0 (__eachIndex0)}
				<section class="rounded-xl border border-[var(--border-color)]">
					<div class="flex items-center justify-between border-b border-[var(--border-color)] px-3 py-3">
						<h2 class="text-[11px] font-semibold">{status}</h2>
						<span class="rounded-full bg-[var(--hover-background)] px-2 py-0.5 text-[10px]"
							>{rows.filter((row) => column(row) === status).length}</span
						>
					</div>
					<div class="min-h-72 space-y-2 p-2">
						{#each rows.filter((row) => column(row) === status) as item, __eachIndex1 (__eachIndex1)}
							<article class="rounded-lg border border-[var(--border-color)] p-3">
								<div class="flex items-start justify-between gap-2">
									<span class="text-[10px] font-semibold">{text(item, "priority") || "—"}</span>
									<span class="text-[9px] text-[var(--text-muted)]">{text(item, "projectId")}</span>
								</div>
								<h3 class="mt-2 text-xs font-semibold leading-5">{text(item, "title") || text(item, "_id")}</h3>
								{#if text(item, "category")}<p class="mt-1 text-[10px] text-[var(--text-muted)]">
										{text(item, "category")}
									</p>{/if}

								{#if text(item, "currentStep")}
									<div class="mt-3">
										<p class="text-[9px] uppercase text-[var(--text-muted)]">Current</p>
										<p class="mt-1 text-[10px] leading-4">{text(item, "currentStep")}</p>
									</div>
								{/if}
								{#if text(item, "nextAction")}
									<div class="mt-3">
										<p class="text-[9px] uppercase text-[var(--text-muted)]">Next action</p>
										<p class="mt-1 text-[10px] leading-4">{text(item, "nextAction")}</p>
									</div>
								{/if}

								{#if text(item, "blocker") || list(item, "blockers").length > 0}
									<div class="mt-3 rounded-md border border-[var(--border-color)] p-2">
										<p class="text-[9px] uppercase text-[var(--text-muted)]">Blocker</p>
										<p class="mt-1 text-[10px] leading-4">
											{text(item, "blocker") || list(item, "blockers").join(", ")}
										</p>
									</div>
								{/if}

								<div class="mt-3 grid grid-cols-2 gap-1 text-[9px] text-[var(--text-muted)]">
									<span>Impact {impactCount(item)}</span>
									<span
										>{text(item, "nextDueAt") ||
											text(item, "dueDate") ||
											text(item, "targetReviewDate") ||
											text(item, "nextReviewAt")}</span
									>
									<span>{text(item, "authority") || "FOIL Project Management"}</span>
									<span>{text(item, "propagationStatus") || "—"}</span>
								</div>

								<details class="mt-3 border-t border-[var(--border-color)] pt-2">
									<summary class="cursor-pointer text-[9px] text-[var(--text-muted)]">Authority / source</summary>
									<div class="mt-2 space-y-1 text-[9px]">
										<p>Authority: FOIL Project Management</p>
										<p>Backlog ref: {text(item, "_id")}</p>
										<p>Authority refs: {list(item, "authorityRefs").join(", ") || "—"}</p>
										{#if trace}<p>{trace.database}.{trace.collection}</p>{/if}
									</div>
								</details>
							</article>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	</div>
</section>
