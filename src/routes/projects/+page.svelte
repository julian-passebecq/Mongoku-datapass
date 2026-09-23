<script lang="ts">
	import { projects, workItems, workStatuses } from "$lib/datapass/controlPlane";

	let selectedProject = $state("all");
	let selectedType = $state("all");

	const visibleItems = $derived(
		workItems.filter((item) =>
			(selectedProject === "all" || item.projectId === selectedProject) &&
			(selectedType === "all" || item.type === selectedType)
		)
	);

	const types = ["task", "bug", "idea", "note", "research", "milestone", "decision"];
</script>

<section class="space-y-6">
	<div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
		<div>
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Projects</p>
			<h1 class="mt-2 text-3xl font-semibold tracking-tight">Work board</h1>
			<p class="mt-2 max-w-3xl text-sm text-[var(--text-muted)]">A focused Kanban over project-management documents, not a generic Mongo collection browser.</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<select bind:value={selectedProject} class="rounded-lg border border-[var(--border-color)] bg-transparent px-3 py-2 text-sm">
				<option value="all">All projects</option>
				{#each projects as project}<option value={project.id}>{project.name}</option>{/each}
			</select>
			<select bind:value={selectedType} class="rounded-lg border border-[var(--border-color)] bg-transparent px-3 py-2 text-sm">
				<option value="all">All item types</option>
				{#each types as type}<option value={type}>{type}</option>{/each}
			</select>
		</div>
	</div>

	<div class="overflow-x-auto pb-3">
		<div class="grid min-w-[1100px] grid-cols-5 gap-4">
			{#each workStatuses as column}
				<section class="rounded-xl border border-[var(--border-color)] bg-[var(--background-color)]">
					<div class="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
						<h2 class="text-sm font-semibold">{column.label}</h2>
						<span class="rounded-full bg-[var(--hover-background)] px-2 py-0.5 text-xs text-[var(--text-muted)]">{visibleItems.filter((item) => item.status === column.id).length}</span>
					</div>
					<div class="min-h-72 space-y-3 p-3">
						{#each visibleItems.filter((item) => item.status === column.id) as item}
							<article class="rounded-lg border border-[var(--border-color)] p-3 shadow-sm">
								<div class="flex items-start justify-between gap-3">
									<span class="rounded-md bg-[var(--hover-background)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{item.type}</span>
									<span class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{item.priority}</span>
								</div>
								<h3 class="mt-3 text-sm font-medium leading-5">{item.title}</h3>
								<p class="mt-2 text-xs text-[var(--text-muted)]">{projects.find((project) => project.id === item.projectId)?.name}</p>
								<div class="mt-3 flex flex-wrap gap-1">{#each item.tags as tag}<span class="rounded border border-[var(--border-color)] px-1.5 py-0.5 text-[10px]">{tag}</span>{/each}</div>
							</article>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	</div>

	<p class="text-xs text-[var(--text-muted)]">Current pass is read-only seeded data. Next backend pass will persist these items in the dedicated Datapass control database.</p>
</section>
