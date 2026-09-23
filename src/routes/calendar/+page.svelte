<script lang="ts">
\n\timport { SvelteMap } from "svelte/reactivity";
	let { data } = $props();

	const project = $derived(data.workspace.projects.find((candidate) => candidate.id === data.projectId));
	const grouped = $derived.by(() => {
		const groups = new SvelteMap<string, typeof data.items>();
		for (const item of data.items) {
			const date = item.dueDate || "Unscheduled";
			const current = groups.get(date) || [];
			current.push(item);
			groups.set(date, current);
		}
		return Array.from(groups.entries());
	});
</script>

<section class="space-y-6">
	<div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
		<div>
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Calendar</p>
			<h1 class="mt-2 text-3xl font-semibold tracking-tight">
				{project ? project.name + " calendar" : "Workspace calendar"}
			</h1>
			<p class="mt-2 text-sm text-[var(--text-muted)]">
				Due-date view generated from the saved Mongo query <code>{data.queryId}</code>.
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<span class="rounded-full border border-[var(--border-color)] px-2.5 py-1 text-xs text-[var(--text-muted)]"
				>Source: {data.workspace.metadata.source}</span
			>
			<span class="rounded-full border border-[var(--border-color)] px-2.5 py-1 text-xs text-[var(--text-muted)]"
				>{data.items.length} items</span
			>
		</div>
	</div>

	<div class="grid gap-4 xl:grid-cols-2">
		{#each grouped as [date, items], __eachIndex0 (__eachIndex0)}
			<section class="rounded-xl border border-[var(--border-color)]">
				<div class="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
					<div>
						<p class="text-xs font-semibold">{date}</p>
						<p class="text-[10px] text-[var(--text-muted)]">{items.length} scheduled</p>
					</div>
				</div>
				<div class="divide-y divide-[var(--border-color)]">
					{#each items as item, __eachIndex1 (__eachIndex1)}
						<div class="px-4 py-3">
							<div class="flex items-start justify-between gap-3">
								<div>
									<p class="text-sm font-medium">{item.title}</p>
									<p class="mt-1 text-[11px] text-[var(--text-muted)]">
										{data.workspace.projects.find((candidate) => candidate.id === item.projectId)?.name}
									</p>
								</div>
								<span class="rounded-full bg-[var(--hover-background)] px-2 py-0.5 text-[10px]">{item.status}</span>
							</div>
							<div class="mt-2 flex flex-wrap gap-1">
								{#each item.tags as tag, __eachIndex2 (__eachIndex2)}<span
										class="rounded border border-[var(--border-color)] px-1.5 py-0.5 text-[10px]">#{tag}</span
									>{/each}
							</div>
						</div>
					{/each}
				</div>
			</section>
		{:else}
			<div class="rounded-xl border border-dashed border-[var(--border-color)] p-8 text-sm text-[var(--text-muted)]">
				No dated open work for this scope.
			</div>
		{/each}
	</div>
</section>
