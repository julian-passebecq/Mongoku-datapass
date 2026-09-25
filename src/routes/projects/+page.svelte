<script lang="ts">
	import { page } from "$app/state";
	import { resolve } from "$app/paths";
	import { isFoilRootProject, workStatuses } from "$lib/datapass/controlPlane";

	let { data } = $props();

	let view = $state<"portfolio" | "work">("portfolio");
	let selectedProject = $state(page.url.searchParams.get("project") || "all");
	let selectedType = $state("all");
	let selectedTag = $state("all");

	const projects = $derived(data.workspace.projects);
	const workItems = $derived(data.workspace.workItems);
	const savedQueries = $derived(data.workspace.savedQueries);
	const portfolioProjects = $derived(data.portfolioProjects);
	const projectSummaries = $derived(data.projectSummaries);

	const types = ["task", "bug", "idea", "note", "research", "milestone", "decision"];
	const tags = $derived(Array.from(new Set(workItems.flatMap((item) => item.tags))).sort());

	const projectScope = $derived.by(() => {
		if (selectedProject === "all") {
			return projects.map((project) => project.id);
		}

		const collect = (projectId: string): string[] => {
			const childIds = projects.filter((project) => project.parentProjectId === projectId).map((project) => project.id);
			return [projectId, ...childIds.flatMap(collect)];
		};

		return collect(selectedProject);
	});

	const visibleItems = $derived(
		workItems.filter(
			(item) =>
				projectScope.includes(item.projectId) &&
				(selectedType === "all" || item.type === selectedType) &&
				(selectedTag === "all" || item.tags.includes(selectedTag)),
		),
	);

	const selectedProjectRecord = $derived(projects.find((project) => project.id === selectedProject));
	const portfolioQuery = $derived(savedQueries.find((query) => query.id === "project-portfolio-board"));
</script>

<section class="space-y-6">
	<div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
		<div>
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Projects</p>
			<h1 class="mt-2 text-3xl font-semibold tracking-tight">Project control</h1>
			<p class="mt-2 max-w-3xl text-sm text-[var(--text-muted)]">
				Portfolio state and global work references are separate. Domain authorities remain external where registered;
				FOIL detailed work is read from FOIL Project Management, not duplicated here.
			</p>
		</div>
		<div class="inline-flex rounded-lg border border-[var(--border-color)] p-1">
			<button
				type="button"
				onclick={() => (view = "portfolio")}
				class={"rounded-md px-3 py-1.5 text-xs font-medium " +
					(view === "portfolio" ? "bg-[var(--hover-background)]" : "")}>Portfolio</button
			>
			<button
				type="button"
				onclick={() => (view = "work")}
				class={"rounded-md px-3 py-1.5 text-xs font-medium " + (view === "work" ? "bg-[var(--hover-background)]" : "")}
				>Work items</button
			>
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
		<span class="rounded-full border border-[var(--border-color)] px-2.5 py-1"
			>Source: {data.workspace.metadata.source}</span
		>
		{#if data.workspace.metadata.controlDatabase}
			<span class="rounded-full border border-[var(--border-color)] px-2.5 py-1"
				>DB: {data.workspace.metadata.controlDatabase}</span
			>
		{/if}
		{#if view === "portfolio" && portfolioQuery}
			<span class="rounded-full border border-[var(--border-color)] px-2.5 py-1">Query: {portfolioQuery.id}</span>
		{/if}
	</div>

	{#if view === "portfolio"}
		<div class="overflow-x-auto pb-3">
			<div class="grid min-w-[1100px] grid-cols-5 gap-4">
				{#each workStatuses as column, __eachIndex0 (__eachIndex0)}
					<section class="rounded-xl border border-[var(--border-color)] bg-[var(--background-color)]">
						<div class="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
							<h2 class="text-sm font-semibold">{column.label}</h2>
							<span class="rounded-full bg-[var(--hover-background)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
								{portfolioProjects.filter((project) => project.kanbanStatus === column.id).length}
							</span>
						</div>

						<div class="min-h-72 space-y-3 p-3">
							{#each portfolioProjects.filter((project) => project.kanbanStatus === column.id) as project, __eachIndex1 (__eachIndex1)}
								<article class="rounded-lg border border-[var(--border-color)] p-3 shadow-sm">
									<div class="flex items-start justify-between gap-3">
										<div class="min-w-0">
											{#if project.parentProjectId}
												<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Subproject</p>
											{/if}
											<h3 class="truncate text-sm font-semibold">{project.name}</h3>
											<p class="mt-1 text-[11px] text-[var(--text-muted)]">{project.category}</p>
										</div>
										<span class="text-[10px] text-[var(--text-muted)]">{project.progress}%</span>
									</div>

									<p class="mt-3 text-xs leading-5 text-[var(--text-muted)]">{project.summary}</p>

									<div class="mt-3 grid grid-cols-2 gap-1 text-[10px]">
										<span class="rounded bg-[var(--hover-background)] px-2 py-1"
											>Todo {projectSummaries[project.id]?.todo ?? 0}</span
										>
										<span class="rounded bg-[var(--hover-background)] px-2 py-1"
											>Doing {projectSummaries[project.id]?.in_progress ?? 0}</span
										>
										<span class="rounded bg-[var(--hover-background)] px-2 py-1"
											>Blocked {projectSummaries[project.id]?.blocked ?? 0}</span
										>
										<span class="rounded bg-[var(--hover-background)] px-2 py-1"
											>Backlog {projectSummaries[project.id]?.backlog ?? 0}</span
										>
									</div>

									<div class="mt-3 flex flex-wrap gap-1">
										{#each project.tags.slice(0, 4) as tag, __eachIndex2 (__eachIndex2)}
											<span class="rounded-full border border-[var(--border-color)] px-1.5 py-0.5 text-[10px]"
												>#{tag}</span
											>
										{/each}
									</div>

									<div class="mt-3 border-t border-[var(--border-color)] pt-2 text-[10px] text-[var(--text-muted)]">
										Status query: {project.statusQueryId || "manual"}
									</div>

									<div class="mt-2 flex gap-3 text-[11px]">
										<a
											href={resolve(
												isFoilRootProject(project.id) ? "/foil/architecture" : "/architecture?project=" + project.id,
											)}
											class="no-underline hover:underline">Graph</a
										>
										{#if isFoilRootProject(project.id)}
											<a href={resolve("/foil/kanban")} class="no-underline hover:underline">Authoritative backlog</a>
										{:else}
											<button
												type="button"
												onclick={() => {
													selectedProject = project.id;
													view = "work";
												}}
												class="hover:underline">Tasks</button
											>
										{/if}
										{#if project.githubRepo}
											<a
												href={"https://github.com/" + project.githubRepo}
												target="_blank"
												rel="noreferrer"
												class="no-underline hover:underline">GitHub</a
											>
										{/if}
									</div>
								</article>
							{/each}
						</div>
					</section>
				{/each}
			</div>
		</div>
	{:else}
		{#if isFoilRootProject(selectedProject)}
			<div class="rounded-xl border border-[var(--border-color)] p-4 text-xs text-[var(--text-muted)]">
				Detailed FOIL tasks are not authoritative here. This view may contain global portfolio work or explicit FOIL
				references only.
				<a href={resolve("/foil/kanban")} class="ml-2 font-medium no-underline hover:underline">
					Open FOIL PM backlog →
				</a>
			</div>
		{/if}
		<div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
			<div>
				<h2 class="text-lg font-semibold">Work-item Kanban</h2>
				{#if selectedProjectRecord?.githubRepo}
					<a
						href={"https://github.com/" + selectedProjectRecord.githubRepo}
						target="_blank"
						rel="noreferrer"
						class="mt-1 inline-block text-xs no-underline hover:underline">GitHub: {selectedProjectRecord.githubRepo}</a
					>
				{/if}
			</div>

			<div class="flex flex-wrap gap-2">
				<select
					bind:value={selectedProject}
					class="rounded-lg border border-[var(--border-color)] bg-transparent px-3 py-2 text-sm"
				>
					<option value="all">All projects</option>
					{#each projects as project, __eachIndex3 (__eachIndex3)}<option value={project.id}
							>{project.parentProjectId ? "↳ " : ""}{project.name}</option
						>{/each}
				</select>
				<select
					bind:value={selectedType}
					class="rounded-lg border border-[var(--border-color)] bg-transparent px-3 py-2 text-sm"
				>
					<option value="all">All item types</option>
					{#each types as type, __eachIndex4 (__eachIndex4)}<option value={type}>{type}</option>{/each}
				</select>
				<select
					bind:value={selectedTag}
					class="rounded-lg border border-[var(--border-color)] bg-transparent px-3 py-2 text-sm"
				>
					<option value="all">All tags</option>
					{#each tags as tag, __eachIndex5 (__eachIndex5)}<option value={tag}>#{tag}</option>{/each}
				</select>
			</div>
		</div>

		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				onclick={() => (selectedTag = "all")}
				class={"rounded-full border border-[var(--border-color)] px-2.5 py-1 text-[11px] " +
					(selectedTag === "all" ? "bg-[var(--hover-background)]" : "")}>All tags</button
			>
			{#each tags as tag, __eachIndex6 (__eachIndex6)}
				<button
					type="button"
					onclick={() => (selectedTag = tag)}
					class={"rounded-full border border-[var(--border-color)] px-2.5 py-1 text-[11px] " +
						(selectedTag === tag ? "bg-[var(--hover-background)]" : "")}>#{tag}</button
				>
			{/each}
		</div>

		<div class="overflow-x-auto pb-3">
			<div class="grid min-w-[1100px] grid-cols-5 gap-4">
				{#each workStatuses as column, __eachIndex7 (__eachIndex7)}
					<section class="rounded-xl border border-[var(--border-color)] bg-[var(--background-color)]">
						<div class="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
							<h2 class="text-sm font-semibold">{column.label}</h2>
							<span class="rounded-full bg-[var(--hover-background)] px-2 py-0.5 text-xs text-[var(--text-muted)]"
								>{visibleItems.filter((item) => item.status === column.id).length}</span
							>
						</div>
						<div class="min-h-72 space-y-3 p-3">
							{#each visibleItems.filter((item) => item.status === column.id) as item, __eachIndex8 (__eachIndex8)}
								<article class="rounded-lg border border-[var(--border-color)] p-3 shadow-sm">
									<div class="flex items-start justify-between gap-3">
										<span
											class="rounded-md bg-[var(--hover-background)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]"
											>{item.type}</span
										>
										<span class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{item.priority}</span>
									</div>
									<h3 class="mt-3 text-sm font-medium leading-5">{item.title}</h3>
									<p class="mt-2 text-xs text-[var(--text-muted)]">
										{projects.find((project) => project.id === item.projectId)?.name}
									</p>
									{#if item.classification === "FOIL_REFERENCE_MIRROR"}
										<div class="mt-2 rounded-md bg-[var(--hover-background)] p-2 text-[10px] text-[var(--text-muted)]">
											Reference only · Authority: {item.externalAuthority || "FOIL Project Management"} · {item.externalProjectRef ||
												""} · {item.externalBacklogRef || ""}
										</div>
									{/if}
									<div class="mt-3 flex flex-wrap gap-1">
										{#each item.tags as tag, __eachIndex9 (__eachIndex9)}
											<button
												type="button"
												onclick={() => (selectedTag = tag)}
												class="rounded border border-[var(--border-color)] px-1.5 py-0.5 text-[10px]">#{tag}</button
											>
										{/each}
									</div>
								</article>
							{/each}
						</div>
					</section>
				{/each}
			</div>
		</div>
	{/if}
</section>
