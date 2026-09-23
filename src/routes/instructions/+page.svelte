<script lang="ts">
	import { instructionProfiles, projects } from "$lib/datapass/controlPlane";

	let selectedProject = $state("all");
	let selectedTag = $state("all");

	const tags = Array.from(new Set(instructionProfiles.flatMap((profile) => profile.tags))).sort();
	const visibleProfiles = $derived(
		instructionProfiles.filter(
			(profile) =>
				(selectedProject === "all" || profile.projectId === selectedProject) &&
				(selectedTag === "all" || profile.tags.includes(selectedTag))
		)
	);
</script>

<section class="space-y-6">
	<div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
		<div>
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Instructions</p>
			<h1 class="mt-2 text-3xl font-semibold tracking-tight">Custom instruction library</h1>
			<p class="mt-2 max-w-3xl text-sm text-[var(--text-muted)]">
				Versioned project instruction profiles that can be associated with AI-role nodes. Storage is modeled now; Mongo persistence/editing comes in the next backend pass.
			</p>
		</div>
		<div class="flex gap-2">
			<select bind:value={selectedProject} class="rounded-lg border border-[var(--border-color)] bg-transparent px-3 py-2 text-sm">
				<option value="all">All projects</option>
				{#each projects.filter((project) => !project.parentProjectId) as project}
					<option value={project.id}>{project.name}</option>
				{/each}
			</select>
			<select bind:value={selectedTag} class="rounded-lg border border-[var(--border-color)] bg-transparent px-3 py-2 text-sm">
				<option value="all">All tags</option>
				{#each tags as tag}<option value={tag}>{tag}</option>{/each}
			</select>
		</div>
	</div>

	<div class="grid gap-4 xl:grid-cols-2">
		{#each visibleProfiles as profile}
			<article class="rounded-xl border border-[var(--border-color)] p-5">
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="text-xs text-[var(--text-muted)]">{projects.find((project) => project.id === profile.projectId)?.name}</p>
						<h2 class="mt-1 text-lg font-semibold">{profile.name}</h2>
						<p class="mt-1 text-sm text-[var(--text-muted)]">{profile.summary}</p>
					</div>
					<span class="rounded-full border border-[var(--border-color)] px-2 py-0.5 text-xs">v{profile.version}</span>
				</div>
				<div class="mt-4 rounded-lg bg-[var(--hover-background)] p-3 text-sm leading-6">{profile.body}</div>
				<div class="mt-4 flex flex-wrap gap-1">
					{#each profile.tags as tag}
						<span class="rounded-full border border-[var(--border-color)] px-2 py-0.5 text-[10px]">#{tag}</span>
					{/each}
				</div>
			</article>
		{/each}
	</div>
</section>
