<script lang="ts">
	import { resolve } from "$app/paths";
	import { projects } from "$lib/datapass/controlPlane";

	let collapsed = $state(false);
	const roots = projects.filter((project) => !project.parentProjectId);

	const childrenOf = (projectId: string) => projects.filter((project) => project.parentProjectId === projectId);
</script>

<aside
	class="sticky top-[57px] hidden h-[calc(100vh-57px)] shrink-0 border-r border-[var(--border-color)] bg-[var(--background-color)] lg:flex lg:flex-col"
	class:w-14={collapsed}
	class:w-64={!collapsed}
>
	<div class="flex items-center justify-between border-b border-[var(--border-color)] px-3 py-3">
		{#if !collapsed}
			<div>
				<p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Workspace</p>
				<p class="mt-0.5 text-sm font-semibold">Projects</p>
			</div>
		{/if}
		<button
			type="button"
			onclick={() => (collapsed = !collapsed)}
			class="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-color)] text-xs hover:bg-[var(--hover-background)]"
			aria-label={collapsed ? "Expand project rail" : "Collapse project rail"}
			title={collapsed ? "Expand project rail" : "Collapse project rail"}
		>
			{collapsed ? ">" : "<"}
		</button>
	</div>

	{#if collapsed}
		<div class="flex flex-1 flex-col items-center gap-2 py-3">
			<a href={resolve("/projects")} class="rounded-md px-2 py-1 text-xs font-semibold no-underline hover:bg-[var(--hover-background)]" title="Projects">P</a>
			<a href={resolve("/architecture")} class="rounded-md px-2 py-1 text-xs font-semibold no-underline hover:bg-[var(--hover-background)]" title="AI architecture">A</a>
			<a href={resolve("/instructions")} class="rounded-md px-2 py-1 text-xs font-semibold no-underline hover:bg-[var(--hover-background)]" title="Instructions">I</a>
		</div>
	{:else}
		<div class="flex-1 overflow-y-auto p-3">
			<div class="mb-3 grid grid-cols-2 gap-2">
				<a href={resolve("/projects")} class="rounded-md border border-[var(--border-color)] px-2 py-1.5 text-center text-[11px] font-medium no-underline hover:bg-[var(--hover-background)]">Board</a>
				<a href={resolve("/architecture")} class="rounded-md border border-[var(--border-color)] px-2 py-1.5 text-center text-[11px] font-medium no-underline hover:bg-[var(--hover-background)]">AI graph</a>
			</div>

			<div class="space-y-2">
				{#each roots as project}
					<details open class="group rounded-lg border border-[var(--border-color)]">
						<summary class="cursor-pointer list-none px-3 py-2">
							<div class="flex items-center justify-between gap-2">
								<div class="min-w-0">
									<p class="truncate text-xs font-semibold">{project.name}</p>
									<p class="truncate text-[10px] text-[var(--text-muted)]">{project.category}</p>
								</div>
								<span class="text-[10px] text-[var(--text-muted)]">{childrenOf(project.id).length}</span>
							</div>
						</summary>
						<div class="border-t border-[var(--border-color)] px-2 py-2">
							<a href={resolve("/architecture") + "?project=" + project.id} class="block rounded px-2 py-1 text-[11px] no-underline hover:bg-[var(--hover-background)]">Architecture</a>
							<a href={resolve("/projects") + "?project=" + project.id} class="block rounded px-2 py-1 text-[11px] no-underline hover:bg-[var(--hover-background)]">Tasks</a>
							{#if project.githubRepo}
								<a href={"https://github.com/" + project.githubRepo} target="_blank" rel="noreferrer" class="block rounded px-2 py-1 text-[11px] no-underline hover:bg-[var(--hover-background)]">GitHub</a>
							{/if}
							{#each childrenOf(project.id) as child}
								<a href={resolve("/architecture") + "?project=" + child.id} class="mt-1 block rounded bg-[var(--hover-background)] px-2 py-1.5 text-[11px] no-underline">
									<span class="font-medium">{child.name}</span>
									<span class="ml-1 text-[var(--text-muted)]">· {child.tags.slice(0, 2).join(", ")}</span>
								</a>
							{/each}
						</div>
					</details>
				{/each}
			</div>
		</div>

		<div class="border-t border-[var(--border-color)] p-3">
			<a href={resolve("/instructions")} class="block rounded-md px-2 py-2 text-xs font-medium no-underline hover:bg-[var(--hover-background)]">Instruction library</a>
		</div>
	{/if}
</aside>
