<script lang="ts">
	import type { ReportResult } from "$lib/datapass/reporting";

	let { data } = $props();
	const report = $derived(data.report as ReportResult);
	const section = $derived(report.sections[0]);
	const rows = $derived(section?.rows ?? []);
	let showResolved = $state(false);

	function text(row: Record<string, unknown>, key: string): string {
		const value = row[key];
		return value == null ? "" : String(value);
	}

	function refs(row: Record<string, unknown>, key: string): string[] {
		const value = row[key];
		return Array.isArray(value) ? value.map(String) : [];
	}

	const visible = $derived(
		rows.filter((row) => showResolved || !/RESOLVED|SUPERSEDED/.test(text(row, "status").toUpperCase())),
	);

	const topics = $derived(Array.from(new Set(visible.map((row) => text(row, "topic") || "Other"))).sort());

	function packageFr(): string {
		const lines = ["Questions FOIL pour Francis", ""];
		for (const topic of topics) {
			lines.push(topic.toUpperCase());
			for (const row of visible.filter((item) => (text(item, "topic") || "Other") === topic)) {
				lines.push(
					"- [" +
						(text(row, "priority") || "P?") +
						"] " +
						(text(row, "questionFr") || text(row, "title") || text(row, "_id")),
				);
			}
			lines.push("");
		}
		return lines.join("\n");
	}

	async function copyPackage() {
		await navigator.clipboard.writeText(packageFr());
	}
</script>

<section class="space-y-6">
	<div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
		<div>
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
				FOIL stakeholder workflow
			</p>
			<h1 class="mt-2 text-3xl font-semibold tracking-tight">Questions for Francis</h1>
			<p class="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">
				The outgoing French question stays separate from internal technical justification, sources and impact routing.
			</p>
		</div>
		<div class="flex gap-2">
			<label class="flex items-center gap-2 rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs">
				<input type="checkbox" bind:checked={showResolved} /> Show resolved
			</label>
			<button
				type="button"
				onclick={copyPackage}
				disabled={visible.length === 0}
				class="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-black"
				>Copy French package</button
			>
		</div>
	</div>

	{#if section && !section.trace.resolved}
		<div class="rounded-xl border border-dashed border-[var(--border-color)] p-5">
			<h2 class="text-sm font-semibold">Questions collection not configured yet</h2>
			<p class="mt-2 text-xs leading-5 text-[var(--text-muted)]">{section.trace.message}</p>
			<p class="mt-2 text-xs text-[var(--text-muted)]">
				Mongoku will not create it automatically. The report contract is ready for the FOIL PM authority when that
				workflow is materialized.
			</p>
		</div>
	{/if}

	{#each topics as topic}
		<section class="rounded-xl border border-[var(--border-color)]">
			<div class="border-b border-[var(--border-color)] px-4 py-3">
				<h2 class="text-sm font-semibold">{topic}</h2>
			</div>
			<div class="divide-y divide-[var(--border-color)]">
				{#each visible.filter((row) => (text(row, "topic") || "Other") === topic) as row}
					<article class="px-4 py-4">
						<div class="flex flex-wrap items-center gap-2">
							<span class="rounded-full bg-[var(--hover-background)] px-2 py-0.5 text-[10px]"
								>{text(row, "priority")}</span
							>
							<span class="text-[10px] text-[var(--text-muted)]">{text(row, "status")}</span>
							<span class="text-[10px] text-[var(--text-muted)]">{text(row, "questionId") || text(row, "_id")}</span>
						</div>
						<p class="mt-3 text-sm font-semibold">{text(row, "questionFr") || text(row, "title")}</p>
						<div class="mt-4 grid gap-4 xl:grid-cols-2">
							<div>
								<p class="text-[10px] font-semibold uppercase text-[var(--text-muted)]">Why asked / relevant</p>
								<p class="mt-1 text-xs leading-5">{text(row, "whyAsked") || text(row, "whyRelevant")}</p>
							</div>
							<div>
								<p class="text-[10px] font-semibold uppercase text-[var(--text-muted)]">Exact information needed</p>
								<p class="mt-1 text-xs leading-5">{text(row, "exactInformationNeeded")}</p>
							</div>
						</div>
						<div class="mt-4 text-[10px] text-[var(--text-muted)]">
							<p>Expected: {text(row, "expectedAnswerType") || "—"}</p>
							<p>Sources: {refs(row, "sourceRefs").join(", ") || "—"}</p>
							<p>Impacts: {refs(row, "impactTargets").join(", ") || "—"}</p>
							<p>Authority hints: {refs(row, "authorityHints").join(", ") || "—"}</p>
						</div>
					</article>
				{/each}
			</div>
		</section>
	{/each}
</section>
