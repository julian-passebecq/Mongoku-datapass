<script lang="ts">
	import type { ReportResult } from "$lib/datapass/reporting";

	let { data } = $props();
	const report = $derived(data.report as ReportResult);
	const section = $derived(report.sections[0]);
	const rows = $derived(section?.rows ?? []);
	const sources = $derived(data.sources ?? []);
	let kind = $state("ALL");

	function text(row: Record<string, unknown>, key: string): string {
		const value = row[key];
		return value == null ? "" : String(value);
	}

	const kinds = $derived(Array.from(new Set(rows.map((row) => text(row, "kind")).filter(Boolean))).sort());
	const visible = $derived(kind === "ALL" ? rows : rows.filter((row) => text(row, "kind") === kind));
	const byId = $derived(new Map(rows.map((row) => [text(row, "_id"), row])));

	function parentName(row: Record<string, unknown>): string {
		const parent = byId.get(text(row, "parentResourceId"));
		return parent ? text(parent, "name") : "";
	}

	function sourceFor(row: Record<string, unknown>) {
		return sources.find((source) => source.resourceRef === text(row, "_id"));
	}

	function canonicalName(row: Record<string, unknown>): string {
		return (
			text(row, "recommendedDisplayName") ||
			sourceFor(row)?.authority ||
			text(row, "canonicalName") ||
			text(row, "name")
		);
	}

	function providerName(row: Record<string, unknown>): string {
		return text(row, "providerName") || sourceFor(row)?.aliases?.[0] || text(row, "name");
	}

	function aliases(row: Record<string, unknown>): string {
		const value = row.aliases;
		const registered = Array.isArray(value) ? value.map(String) : [];
		const sourceAliases = sourceFor(row)?.aliases ?? [];
		return Array.from(new Set([...registered, ...sourceAliases])).join(", ");
	}
</script>

<section class="space-y-6">
	<div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
		<div>
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">FOIL canonical inventory</p>
			<h1 class="mt-2 text-3xl font-semibold tracking-tight">Resource registry</h1>
			<p class="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">
				FOIL Project Management <code>resource_registry</code> is consulted before provider enumeration. Provider APIs are
				discovery/verification, not existence authority.
			</p>
		</div>
		<select bind:value={kind} class="rounded-lg border border-[var(--border-color)] bg-transparent px-3 py-2 text-xs">
			<option value="ALL">All resource kinds</option>
			{#each kinds as item, __eachIndex0 (__eachIndex0)}<option value={item}>{item}</option>{/each}
		</select>
	</div>

	{#if section && !section.trace.resolved}
		<div class="rounded-xl border border-dashed border-[var(--border-color)] p-5 text-sm text-[var(--text-muted)]">
			{section.trace.message}
		</div>
	{/if}

	<div class="overflow-x-auto rounded-xl border border-[var(--border-color)]">
		<table class="min-w-[1350px] w-full text-left text-xs">
			<thead class="border-b border-[var(--border-color)] bg-[var(--hover-background)]">
				<tr>
					<th class="px-3 py-3 font-semibold">Canonical name</th>
					<th class="px-3 py-3 font-semibold">Provider name / aliases</th>
					<th class="px-3 py-3 font-semibold">Kind</th>
					<th class="px-3 py-3 font-semibold">Authority role</th>
					<th class="px-3 py-3 font-semibold">Provider</th>
					<th class="px-3 py-3 font-semibold">External / project ID</th>
					<th class="px-3 py-3 font-semibold">Parent cluster / DB / repo</th>
					<th class="px-3 py-3 font-semibold">Status</th>
					<th class="px-3 py-3 font-semibold">Default route</th>
					<th class="px-3 py-3 font-semibold">Last verified</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-[var(--border-color)]">
				{#each visible as row, __eachIndex1 (__eachIndex1)}
					<tr class="align-top">
						<td class="px-3 py-3 font-medium">{canonicalName(row)}</td>
						<td class="px-3 py-3">
							<p>{providerName(row)}</p>
							{#if aliases(row)}<p class="mt-1 text-[10px] text-[var(--text-muted)]">{aliases(row)}</p>{/if}
						</td>
						<td class="px-3 py-3">{text(row, "kind")}</td>
						<td class="max-w-80 px-3 py-3 text-[var(--text-muted)]">{text(row, "role") || text(row, "scope")}</td>
						<td class="px-3 py-3">{text(row, "provider")}</td>
						<td class="px-3 py-3 font-mono text-[10px]">{text(row, "externalId") || text(row, "_id")}</td>
						<td class="px-3 py-3">{parentName(row) || text(row, "parentResourceId")}</td>
						<td class="px-3 py-3">{text(row, "status")}</td>
						<td class="px-3 py-3">{row.defaultRoute === false ? "No" : row.defaultRoute === true ? "Yes" : "—"}</td>
						<td class="px-3 py-3">{text(row, "verifiedAt")}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if section}
		<p class="text-[10px] text-[var(--text-muted)]">
			Source: {section.trace.authority} · {section.trace.resourceRef} · {section.trace.database}.{section.trace
				.collection} · READ ONLY
		</p>
	{/if}
</section>
