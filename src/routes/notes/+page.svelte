<script lang="ts">
	let { data } = $props();
	const project = $derived(data.workspace.projects.find((candidate) => candidate.id === data.projectId));
</script>

<section class="space-y-6">
	<div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
		<div>
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Notes</p>
			<h1 class="mt-2 text-3xl font-semibold tracking-tight">{project ? project.name + " notes" : "Workspace notes"}</h1>
			<p class="mt-2 text-sm text-[var(--text-muted)]">Notes, decisions and research surfaced by <code>{data.queryId}</code>.</p>
		</div>
		<span class="rounded-full border border-[var(--border-color)] px-2.5 py-1 text-xs text-[var(--text-muted)]">Source: {data.workspace.metadata.source}</span>
	</div>

	<div class="grid gap-4 xl:grid-cols-2">
		{#each data.items as item}
			<article class="rounded-xl border border-[var(--border-color)] p-5">
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{item.type}</p>
						<h2 class="mt-1 text-sm font-semibold">{item.title}</h2>
						<p class="mt-1 text-[11px] text-[var(--text-muted)]">{data.workspace.projects.find((candidate) => candidate.id === item.projectId)?.name}</p>
					</div>
					{#if item.createdAt}<span class="text-[10px] text-[var(--text-muted)]">{item.createdAt}</span>{/if}
				</div>
				<div class="mt-4 flex flex-wrap gap-1">
					{#each item.tags as tag}<span class="rounded-full bg-[var(--hover-background)] px-2 py-0.5 text-[10px]">#{tag}</span>{/each}
				</div>
			</article>
		{:else}
			<div class="rounded-xl border border-dashed border-[var(--border-color)] p-8 text-sm text-[var(--text-muted)]">No notes, decisions or research items for this scope.</div>
		{/each}
	</div>
</section>
