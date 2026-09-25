<script lang="ts">
	import { resolve } from "$app/paths";
	import type { ReportResult } from "$lib/datapass/reporting";

	let { data } = $props();
	const report = $derived(data.report as ReportResult);
	const summary = $derived(report.sections.find((section) => section.id === "summary")?.rows[0]);
	const sections = $derived(report.sections.filter((section) => section.id !== "summary"));

	function text(row: Record<string, unknown> | undefined, key: string): string {
		const value = row?.[key];
		return value == null ? "" : String(value);
	}

	function needsAction(row: Record<string, unknown>): boolean {
		return text(row, "actionKind") !== "none";
	}

	const stateClass: Record<string, string> = {
		fresh: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
		reachable: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
		aging: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
		stale: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
		unavailable: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
	};

	function chips(row: Record<string, unknown>): string[] {
		return ["availability", "freshness", "lifecycleClass", "status", "severity"]
			.map((key) => text(row, key))
			.filter((value, index, all) => value && all.indexOf(value) === index)
			.slice(0, 3);
	}
</script>

<section class="space-y-6">
	<div>
		<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Global report · read-only</p>
		<h1 class="mt-2 text-3xl font-semibold tracking-tight">{report.title}</h1>
		<p class="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">{report.description}</p>
		<p class="mt-1 text-[10px] text-[var(--text-muted)]">Generated {report.generatedAt} · nothing is executed</p>
	</div>

	{#if summary}
		<section class="rounded-xl border border-[var(--border-color)] p-4">
			<p class="text-sm">{text(summary, "summary")}</p>
			<p class="mt-3 text-sm font-semibold">
				Next: {text(summary, "nextAction")}
			</p>
		</section>
	{/if}

	{#each sections as section (section.id)}
		<section class="rounded-xl border border-[var(--border-color)]">
			<div class="flex items-center justify-between gap-2 border-b border-[var(--border-color)] px-4 py-3">
				<div>
					<h2 class="text-sm font-semibold">{section.label}</h2>
					<p class="text-[10px] text-[var(--text-muted)]">Authority: {section.authority}</p>
				</div>
				<span class="rounded-full border border-[var(--border-color)] px-2 py-1 text-[10px]">
					{section.trace.resolved
						? section.rows.filter(needsAction).length + " to act on · " + section.rows.length + " rows"
						: "source unavailable"}
				</span>
			</div>

			{#if section.trace.resolved}
				<div class="divide-y divide-[var(--border-color)]">
					{#each section.rows as row, index (text(row, "_id") || index)}
						<div class="flex flex-col gap-1 px-4 py-3 md:flex-row md:items-start md:justify-between md:gap-6">
							<div class="min-w-0">
								<p class="text-sm font-medium">
									{#if text(row, "openUri").startsWith("/")}
										<a href={resolve(text(row, "openUri"))} class="hover:underline">{text(row, "title")}</a>
									{:else}
										{text(row, "title")}
									{/if}
								</p>
								<p class="mt-1 text-xs text-[var(--text-muted)]">{text(row, "summary")}</p>
								<div class="mt-1 flex flex-wrap gap-1">
									{#each chips(row) as chip (chip)}
										<span class="rounded px-1.5 py-0.5 text-[10px] {stateClass[chip] ?? 'bg-[var(--hover-background)]'}"
											>{chip}</span
										>
									{/each}
								</div>
							</div>
							<p
								class="shrink-0 text-xs md:max-w-xs md:text-right {needsAction(row)
									? 'font-semibold'
									: 'text-[var(--text-muted)]'}"
							>
								{text(row, "nextAction")}
							</p>
						</div>
					{:else}
						<p class="p-4 text-xs text-[var(--text-muted)]">Nothing recorded for this section.</p>
					{/each}
				</div>
			{:else}
				<p class="p-4 text-xs text-[var(--text-muted)]">
					{section.trace.message || "Source unavailable."} Nothing is substituted.
				</p>
			{/if}
		</section>
	{/each}
</section>
