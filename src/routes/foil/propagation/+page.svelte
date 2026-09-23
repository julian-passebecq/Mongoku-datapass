<script lang="ts">
	import type { ReportResult } from "$lib/datapass/reporting";

	let { data } = $props();
	const report = $derived(data.report as ReportResult);
	const section = $derived(report.sections.find((item) => item.id === "pending"));
	const unassessedSection = $derived(report.sections.find((item) => item.id === "unassessed"));
	const rows = $derived(section?.rows ?? []);
	const unassessed = $derived(unassessedSection?.rows ?? []);

	const lifecycle = [
		"NEW_INPUT",
		"CLASSIFIED",
		"PRIMARY_AUTHORITY_UPDATED",
		"IMPACT_ANALYZED",
		"DEPENDENT_TARGETS_DIRTY",
		"DEFERRED / READY_TO_PROPAGATE",
		"APPLIED",
		"VERIFY_REQUIRED",
		"VERIFIED / RECONCILED",
	];

	function text(row: Record<string, unknown>, key: string): string {
		const value = row[key];
		return value == null ? "" : String(value);
	}

	function targets(row: Record<string, unknown>): Array<Record<string, unknown> | string> {
		const value = row.impactTargets;
		return Array.isArray(value) ? (value as Array<Record<string, unknown> | string>) : [];
	}
</script>

<section class="space-y-6">
	<div>
		<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">FOIL impact control</p>
		<h1 class="mt-2 text-3xl font-semibold tracking-tight">Pending propagation</h1>
		<p class="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">
			A new input can update its primary authority immediately while dependent apps remain explicitly DIRTY, DEFERRED or
			VERIFY_REQUIRED until a reviewed propagation batch is applied.
		</p>
	</div>

	<div class="overflow-x-auto rounded-xl border border-[var(--border-color)] p-3">
		<div class="flex min-w-[1100px] items-center gap-2">
			{#each lifecycle as state, index}
				<div class="flex items-center gap-2">
					<span class="rounded-md bg-[var(--hover-background)] px-2 py-1 text-[10px] font-medium">{state}</span>
					{#if index < lifecycle.length - 1}<span class="text-[var(--text-muted)]">→</span>{/if}
				</div>
			{/each}
		</div>
	</div>

	{#if section && !section.trace.resolved}
		<div class="rounded-xl border border-dashed border-[var(--border-color)] p-5 text-xs text-[var(--text-muted)]">
			<p>{section.trace.message}</p>
			<p class="mt-2">
				Propagation is read from FOIL Project Management events. Mongoku does not create a separate propagation
				collection.
			</p>
		</div>
	{/if}

	{#if unassessed.length > 0}
		<div class="rounded-xl border border-[var(--border-color)] p-5">
			<h2 class="text-sm font-semibold">Propagation coverage incomplete</h2>
			<p class="mt-2 text-xs text-[var(--text-muted)]">
				{unassessed.length} PM event(s) have no propagationStatus or impactTargets metadata. They are unassessed/legacy records,
				not explicit NO_IMPACT decisions.
			</p>
			<details class="mt-3">
				<summary class="cursor-pointer text-xs">Show unassessed events</summary>
				<div class="mt-3 space-y-2">
					{#each unassessed.slice(0, 20) as row}
						<div class="rounded-lg bg-[var(--hover-background)] p-3 text-xs">
							<p class="font-medium">{text(row, "title") || text(row, "_id")}</p>
							<p class="mt-1 text-[10px] text-[var(--text-muted)]">
								{text(row, "eventType")} · {text(row, "occurredAt")}
							</p>
						</div>
					{/each}
				</div>
			</details>
		</div>
	{/if}

	<div class="space-y-4">
		{#each rows as row}
			<article class="rounded-xl border border-[var(--border-color)] p-5">
				<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
					<div>
						<p class="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
							{text(row, "propagationPriority") || "priority —"}
						</p>
						<h2 class="mt-1 text-base font-semibold">{text(row, "title") || text(row, "_id")}</h2>
						<p class="mt-1 text-xs text-[var(--text-muted)]">
							Source revision: {text(row, "sourceRevision") || "—"} · detected {text(row, "detectedAt") || "—"}
						</p>
					</div>
					<span class="rounded-full border border-[var(--border-color)] px-2.5 py-1 text-xs"
						>{text(row, "propagationStatus")}</span
					>
				</div>

				<div class="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
					{#each targets(row) as target}
						<div class="rounded-lg bg-[var(--hover-background)] p-3">
							{#if typeof target === "string"}
								<p class="text-xs font-medium">{target}</p>
							{:else}
								<p class="text-xs font-medium">{String(target.name ?? target.target ?? target.id ?? "Target")}</p>
								<p class="mt-1 text-[10px] text-[var(--text-muted)]">
									{String(target.status ?? target.state ?? "DIRTY")}
								</p>
							{/if}
						</div>
					{/each}
				</div>

				<div class="mt-4 text-[10px] text-[var(--text-muted)]">
					Authority: FOIL Project Management · Ref: {text(row, "_id")} · Required by: {text(row, "requiredBy") || "—"}
				</div>
			</article>
		{/each}
	</div>
</section>
