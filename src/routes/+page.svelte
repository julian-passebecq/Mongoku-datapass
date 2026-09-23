<script lang="ts">
	import { resolve } from "$app/paths";
	import { projects, workItems } from "$lib/datapass/controlPlane";

	const active = workItems.filter((item) => item.status === "in_progress");
	const blocked = workItems.filter((item) => item.status === "blocked");
	const open = workItems.filter((item) => item.status !== "done");
</script>

<section class="space-y-8">
	<div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
		<div>
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Control plane</p>
			<h1 class="mt-2 text-3xl font-semibold tracking-tight">Everything important, without browsing everything.</h1>
			<p class="mt-2 max-w-3xl text-sm text-[var(--text-muted)]">
				Project work, FOIL operations and focused MongoDB exploration share one lightweight workspace.
			</p>
		</div>
		<a href={resolve("/projects")} class="inline-flex items-center justify-center rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm font-medium no-underline hover:bg-[var(--hover-background)]">
			Open project board
		</a>
	</div>

	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
		<div class="rounded-xl border border-[var(--border-color)] p-5"><p class="text-xs uppercase tracking-wide text-[var(--text-muted)]">Active projects</p><p class="mt-2 text-3xl font-semibold">{projects.filter((project) => project.status === "active").length}</p></div>
		<div class="rounded-xl border border-[var(--border-color)] p-5"><p class="text-xs uppercase tracking-wide text-[var(--text-muted)]">Open work</p><p class="mt-2 text-3xl font-semibold">{open.length}</p></div>
		<div class="rounded-xl border border-[var(--border-color)] p-5"><p class="text-xs uppercase tracking-wide text-[var(--text-muted)]">In progress</p><p class="mt-2 text-3xl font-semibold">{active.length}</p></div>
		<div class="rounded-xl border border-[var(--border-color)] p-5"><p class="text-xs uppercase tracking-wide text-[var(--text-muted)]">Blocked</p><p class="mt-2 text-3xl font-semibold">{blocked.length}</p></div>
	</div>

	<div class="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
		<section class="rounded-xl border border-[var(--border-color)]">
			<div class="flex items-center justify-between border-b border-[var(--border-color)] px-5 py-4">
				<div><h2 class="font-semibold">Projects</h2><p class="text-xs text-[var(--text-muted)]">Current control-plane scope</p></div>
				<a href={resolve("/projects")} class="text-sm no-underline hover:underline">View board</a>
			</div>
			<div class="divide-y divide-[var(--border-color)]">
				{#each projects as project}
					<div class="grid gap-3 px-5 py-4 md:grid-cols-[1fr_180px_72px] md:items-center">
						<div><p class="font-medium">{project.name}</p><p class="mt-1 text-xs text-[var(--text-muted)]">{project.summary}</p></div>
						<div>
							<div class="h-2 overflow-hidden rounded-full bg-[var(--hover-background)]"><div class="h-full rounded-full bg-current" style:width={project.progress + "%"}></div></div>
							<p class="mt-1 text-[11px] text-[var(--text-muted)]">{project.progress}% mapped</p>
						</div>
						<p class="text-sm text-[var(--text-muted)]">{project.activeItems} open</p>
					</div>
				{/each}
			</div>
		</section>

		<section class="rounded-xl border border-[var(--border-color)] p-5">
			<div class="flex items-start justify-between gap-4">
				<div><p class="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">FOIL</p><h2 class="mt-1 text-xl font-semibold">System visibility</h2></div>
				<span class="rounded-full border border-[var(--border-color)] px-2.5 py-1 text-xs">Prototype data</span>
			</div>
			<div class="mt-6 space-y-3 text-sm">
				<div class="flex items-center justify-between rounded-lg bg-[var(--hover-background)] px-3 py-2"><span>MongoDB</span><span>Healthy</span></div>
				<div class="flex items-center justify-between rounded-lg bg-[var(--hover-background)] px-3 py-2"><span>Kafka</span><span>Healthy</span></div>
				<div class="flex items-center justify-between rounded-lg bg-[var(--hover-background)] px-3 py-2"><span>Fabric</span><span>Needs connection</span></div>
			</div>
			<a href={resolve("/foil")} class="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm font-medium no-underline hover:bg-[var(--hover-background)]">Open FOIL system map</a>
		</section>
	</div>
</section>
