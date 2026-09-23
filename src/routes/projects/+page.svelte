<script lang="ts">
	import { page } from "$app/state";
	import { projects, workItems, workStatuses } from "$lib/datapass/controlPlane";

	let selectedProject = $state(page.url.searchParams.get("project") || "all");
	let selectedType = $state("all");
	let selectedTag = $state("all");

	const types = ["task", "bug", "idea", "note", "research", "milestone", "decision"];
	const tags = Array.from(new Set(workItems.flatMap((item) => item.tags))).sort();

	const projectScope = $derived.by(() => {
		if (selectedProject === "all") return projects.map((project) => project.id);
		const childIds = projects.filter((project) => project.parentProjectId === selectedProject).map((project) => project.id);
		return [selectedProject, ...childIds];
	});

	const visibleItems = $derived(
		workItems.filter((item) =>
			projectScope.includes(item.projectId) &&
			(selectedType === "all" || item.type === selectedType) &&
			(selectedTag === "all" || item.tags.includes(selectedTag))
		)
	);

	const selectedProjectRecord = $derived(projects.find((project) => project.id === selectedProject));
</script>

<section class="space-y-6">
	<div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
		<div>
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Projects</p>
			<h1 class="mt-2 text-3xl font-semibold tracking-tight">Work board</h1>
			<p class="mt-2 max-w-3xl text-sm text-[var(--text-muted)]">A focused Kanban over project-management documents, with project, subproject and tag context.</p>
			{#if selectedProjectRecord?.githubRepo}
				<a href={"https://github.com/" + selectedProjectRecord.githubRepo} target="_blank" rel="noreferrer" class="mt-2 inline-block text-xs no-underline hover:underline">
					GitHub: {selectedProjectRecord.githubRepo}
				</a>
			{/if}
		</div>
		<div class="flex flex-wrap gap-2">
			<select bind:value={selectedProject} class="rounded-lg border border-[var(--border-color)] bg-transparent px-3 py-2 text-sm">
				<option value="all">All projects</option>
				{#each projects as project}<option value={project.id}>{project.parentProjectId ? "↳ " : ""}{project.name}</option>{/each}
			</select>
			<select bind:value={selectedType} class="rounded-lg border border-[var(--border-color)] bg-transparent px-3 py-2 text-sm">
				<option value="all">All item types</option>
				{#each types as type}<option value={type}>{type}</option>{/each}
			</select>
			<select bind:value={selectedTag} class="rounded-lg border border-[var(--border-color)] bg-transparent px-3 py-2 text-sm">
				<option value="all">All tags</option>
				{#each tags as tag}<option value={tag}>#{tag}</option>{/each}
			</select>
		</div>
	</div>

	<div class="flex flex-wrap gap-2">
		<button type="button" onclick={() => (selectedTag = "all")} class="rounded-full border border-[var(--border-color)] px-2.5 py-1 text-[11px]" class:bg-[var(--hover-background)]={selectedTag === "all"}>All tags</button>
		{#each tags as tag}
			<button type="button" onclick={() => (selectedTag = tag)} class="rounded-full border border-[var(--border-color)] px-2.5 py-1 text-[11px]" class:bg-[var(--hover-background)]={selectedTag === tag}>#{tag}</button>
		{/each}
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
								<div class="mt-3 flex flex-wrap gap-1">
									{#each item.tags as tag}
										<button type="button" onclick={() => (selectedTag = tag)} class="rounded border border-[var(--border-color)] px-1.5 py-0.5 text-[10px]">#{tag}</button>
									{/each}
								</div>
							</article>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	</div>

	<p class="text-xs text-[var(--text-muted)]">The board is still using seeded typed data. The next backend pass will persist projects, tags, work items, instruction profiles and graph nodes in the Datapass control database.</p>
</section>
