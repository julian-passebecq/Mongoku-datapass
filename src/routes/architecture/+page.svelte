<script lang="ts">
	import { page } from "$app/state";

	let { data } = $props();
	const projects = $derived(data.controlWorkspace.projects);
	const agentNodes = $derived(data.controlWorkspace.agentNodes);
	const instructionProfiles = $derived(data.controlWorkspace.instructionProfiles);
	const graphProjects = $derived(
		projects.filter((project) => agentNodes.some((node) => node.projectId === project.id)),
	);
	let selectedProject = $state(page.url.searchParams.get("project") || "foil");

	const selectedNodes = $derived(agentNodes.filter((node) => node.projectId === selectedProject));
	const selectedProjectRecord = $derived(projects.find((project) => project.id === selectedProject));

	const depthOf = (nodeId: string): number => {
		const node = selectedNodes.find((candidate) => candidate.id === nodeId);
		if (!node?.parentId) {
			return 0;
		}
		return 1 + depthOf(node.parentId);
	};

	const levels = $derived.by(() => {
		const maxDepth = Math.max(0, ...selectedNodes.map((node) => depthOf(node.id)));
		return Array.from({ length: maxDepth + 1 }, (_, depth) =>
			selectedNodes.filter((node) => depthOf(node.id) === depth),
		);
	});

	const instructionName = (instructionProfileId?: string) =>
		instructionProfiles.find((profile) => profile.id === instructionProfileId)?.name;
</script>

<section class="space-y-6">
	<div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
		<div>
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">AI architecture</p>
			<h1 class="mt-2 text-3xl font-semibold tracking-tight">Project agent graph</h1>
			<p class="mt-2 max-w-3xl text-sm text-[var(--text-muted)]">
				Leader, peer specialists and recursive child agents. Each node keeps role, responsibilities, Mongo scope, tags
				and optional instruction profile.
			</p>
		</div>
		<select
			bind:value={selectedProject}
			class="rounded-lg border border-[var(--border-color)] bg-transparent px-3 py-2 text-sm"
		>
			{#each graphProjects as project}
				<option value={project.id}>{project.name}</option>
			{/each}
		</select>
	</div>

	{#if selectedProjectRecord}
		<div class="grid gap-4 md:grid-cols-3">
			<div class="rounded-xl border border-[var(--border-color)] p-4">
				<p class="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">GitHub</p>
				{#if selectedProjectRecord.githubRepo}
					<a
						href={"https://github.com/" + selectedProjectRecord.githubRepo}
						target="_blank"
						rel="noreferrer"
						class="mt-2 block text-sm font-medium no-underline hover:underline">{selectedProjectRecord.githubRepo}</a
					>
				{:else}
					<p class="mt-2 text-sm text-[var(--text-muted)]">No repo linked</p>
				{/if}
			</div>
			<div class="rounded-xl border border-[var(--border-color)] p-4">
				<p class="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Mongo context</p>
				<p class="mt-2 text-sm font-medium">{selectedProjectRecord.mongoContextKey || "Not linked"}</p>
			</div>
			<div class="rounded-xl border border-[var(--border-color)] p-4">
				<p class="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Namespaces</p>
				<p class="mt-2 text-xs leading-5 text-[var(--text-muted)]">
					{selectedProjectRecord.mongoNamespaces?.join(" · ") || "None"}
				</p>
			</div>
		</div>
	{/if}

	{#if selectedNodes.length === 0}
		<div class="rounded-xl border border-dashed border-[var(--border-color)] p-8 text-sm text-[var(--text-muted)]">
			No AI-role graph exists for this project yet.
		</div>
	{:else}
		<div class="overflow-x-auto rounded-xl border border-[var(--border-color)] p-6">
			<div class="min-w-[900px] space-y-10">
				{#each levels as level, depth}
					<div class="relative">
						{#if depth > 0}
							<div class="absolute -top-6 left-1/2 h-6 w-px bg-[var(--border-color)]"></div>
						{/if}
						<div class="flex justify-center gap-5">
							{#each level as node}
								<article
									class="w-64 rounded-xl border border-[var(--border-color)] bg-[var(--background-color)] p-4 shadow-sm"
								>
									<div class="flex items-start justify-between gap-3">
										<div>
											<p class="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
												{node.role}
											</p>
											<h2 class="mt-1 font-semibold">{node.label}</h2>
										</div>
										<span class="rounded-full bg-[var(--hover-background)] px-2 py-0.5 text-[10px]">L{depth}</span>
									</div>

									<div class="mt-3">
										<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Responsibilities</p>
										<p class="mt-1 text-xs">{node.responsibilities.join(" · ")}</p>
									</div>

									<div class="mt-3">
										<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Mongo scope</p>
										<div class="mt-1 flex flex-wrap gap-1">
											{#each node.mongoScope as scope}
												<span class="rounded border border-[var(--border-color)] px-1.5 py-0.5 text-[10px]"
													>{scope}</span
												>
											{/each}
										</div>
									</div>

									{#if instructionName(node.instructionProfileId)}
										<div class="mt-3 rounded-md bg-[var(--hover-background)] px-2 py-1.5 text-[11px]">
											Instruction: {instructionName(node.instructionProfileId)}
										</div>
									{/if}

									<div class="mt-3 flex flex-wrap gap-1">
										{#each node.tags as tag}
											<span class="rounded-full bg-[var(--hover-background)] px-2 py-0.5 text-[10px]">#{tag}</span>
										{/each}
									</div>

									{#if node.githubRepo}
										<a
											href={"https://github.com/" + node.githubRepo}
											target="_blank"
											rel="noreferrer"
											class="mt-3 inline-block text-[11px] no-underline hover:underline">GitHub repo</a
										>
									{/if}
								</article>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<div class="rounded-xl border border-[var(--border-color)] p-5">
		<h2 class="font-semibold">Why this graph exists</h2>
		<p class="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">
			The diagram is an AI coordination model, not the MongoDB server topology. It makes ownership and context explicit
			so a leader agent can route work to the correct specialist, while every child can retain a narrower Mongo context
			and instruction profile.
		</p>
	</div>
</section>
