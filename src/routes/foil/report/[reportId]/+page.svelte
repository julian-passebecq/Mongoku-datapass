<script lang="ts">
	import type { ReportResult } from "$lib/datapass/reporting";

	let { data } = $props();
	const report = $derived(data.report as ReportResult);

	function text(row: Record<string, unknown>, key: string): string {
		const value = row[key];
		return value == null ? "" : String(value);
	}
</script>

<section class="space-y-6">
	<div>
		<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">FOIL report</p>
		<h1 class="mt-2 text-3xl font-semibold tracking-tight">{report.title}</h1>
		<p class="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">{report.description}</p>
	</div>

	{#each report.sections as section, __eachIndex0 (__eachIndex0)}
		<section class="rounded-xl border border-[var(--border-color)]">
			<div
				class="flex flex-col gap-2 border-b border-[var(--border-color)] px-4 py-3 md:flex-row md:items-center md:justify-between"
			>
				<div>
					<h2 class="text-sm font-semibold">{section.label}</h2>
					<p class="text-[10px] text-[var(--text-muted)]">Authority: {section.authority}</p>
				</div>
				<span class="rounded-full border border-[var(--border-color)] px-2 py-1 text-[10px]">
					{section.trace.resolved ? section.rows.length + " rows" : "source unavailable"}
				</span>
			</div>

			{#if section.trace.resolved}
				<div class="divide-y divide-[var(--border-color)]">
					{#each section.rows as row, __eachIndex1 (__eachIndex1)}
						<div class="px-4 py-3">
							<p class="text-sm font-medium">
								{text(row, "title") || text(row, "name") || text(row, "_id") || "Record"}
							</p>
							<p class="mt-1 text-xs text-[var(--text-muted)]">
								{text(row, "summary") || text(row, "nextAction") || text(row, "status")}
							</p>
							<details class="mt-2">
								<summary class="cursor-pointer text-[10px] text-[var(--text-muted)]">Raw source record</summary>
								<pre
									class="mt-2 max-h-80 overflow-auto rounded-lg bg-[var(--hover-background)] p-3 text-[10px] leading-5">{JSON.stringify(
										row,
										null,
										2,
									)}</pre>
							</details>
						</div>
					{:else}
						<p class="p-4 text-xs text-[var(--text-muted)]">The authoritative source returned no rows.</p>
					{/each}
				</div>
			{:else}
				<div class="p-4 text-xs text-[var(--text-muted)]">
					<p>{section.trace.message || "Source not configured."}</p>
					<p class="mt-2">No collection/database is created by this report.</p>
				</div>
			{/if}

			<div
				class="border-t border-[var(--border-color)] bg-[var(--hover-background)] px-4 py-3 text-[10px] text-[var(--text-muted)]"
			>
				<p>
					{section.trace.sourceId} · {section.trace.resourceRef} · {section.trace.database ||
						"database from server binding"} · {section.trace.collection} · {section.trace.operation} · READ ONLY
				</p>
				{#if section.trace.resourceRegistry?.found}
					<p class="mt-1">
						PM registry: {section.trace.resourceRegistry.canonicalName || section.trace.resourceRegistry.resourceId}
						{#if section.trace.resourceRegistry.providerName && section.trace.resourceRegistry.providerName !== section.trace.resourceRegistry.canonicalName}
							· provider {section.trace.resourceRegistry.providerName}
						{/if}
						{#if section.trace.resourceRegistry.aliases?.length}
							· aliases {section.trace.resourceRegistry.aliases.join(", ")}
						{/if}
						{#if section.trace.resourceRegistry.lastVerifiedAt}
							· verified {section.trace.resourceRegistry.lastVerifiedAt}
						{/if}
					</p>
				{/if}
			</div>
		</section>
	{/each}
</section>
