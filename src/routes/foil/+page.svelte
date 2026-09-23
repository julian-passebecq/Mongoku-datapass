<script lang="ts">
	import { foilEdges, foilNodes } from "$lib/datapass/controlPlane";

	const nodeById = new Map(foilNodes.map((node) => [node.id, node]));
	const flowRows = foilEdges.map((edge) => ({ ...edge, fromNode: nodeById.get(edge.from), toNode: nodeById.get(edge.to) }));
</script>

<section class="space-y-6">
	<div>
		<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">FOIL</p>
		<h1 class="mt-2 text-3xl font-semibold tracking-tight">System map</h1>
		<p class="mt-2 max-w-3xl text-sm text-[var(--text-muted)]">One operational view for the turbine simulator, streaming layer, MongoDB and analytics consumers.</p>
	</div>

	<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
		{#each foilNodes as node}
			<article class="rounded-xl border border-[var(--border-color)] p-4">
				<div class="flex items-center justify-between">
					<span class="text-xs uppercase tracking-wide text-[var(--text-muted)]">{node.kind}</span>
					<span class="h-2.5 w-2.5 rounded-full" class:bg-green-500={node.state === "healthy"} class:bg-amber-500={node.state === "warning"} class:bg-red-500={node.state === "offline"}></span>
				</div>
				<h2 class="mt-3 font-semibold">{node.label}</h2>
				<p class="mt-1 text-xs text-[var(--text-muted)]">{node.detail}</p>
			</article>
		{/each}
	</div>

	<div class="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
		<section class="rounded-xl border border-[var(--border-color)] p-5">
			<div class="flex items-center justify-between">
				<div><h2 class="font-semibold">Data flow</h2><p class="text-xs text-[var(--text-muted)]">Explicit edges now; live discovery comes next.</p></div>
				<a href="/topology" class="text-sm no-underline hover:underline">Topology view</a>
			</div>
			<div class="mt-5 space-y-2">
				{#each flowRows as row}
					<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg bg-[var(--hover-background)] px-3 py-3 text-sm">
						<div class="font-medium">{row.fromNode?.label}</div>
						<div class="flex items-center gap-2 text-xs text-[var(--text-muted)]"><span>{row.label}</span><span aria-hidden="true">-&gt;</span></div>
						<div class="font-medium">{row.toNode?.label}</div>
					</div>
				{/each}
			</div>
		</section>

		<section class="rounded-xl border border-[var(--border-color)] p-5">
			<p class="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">MongoDB</p>
			<h2 class="mt-1 text-xl font-semibold">Replica visibility</h2>
			<div class="mt-5 space-y-3 text-sm">
				<div class="flex items-center justify-between"><span class="text-[var(--text-muted)]">Replica set</span><span>Not connected</span></div>
				<div class="flex items-center justify-between"><span class="text-[var(--text-muted)]">Primary</span><span>Discovery pending</span></div>
				<div class="flex items-center justify-between"><span class="text-[var(--text-muted)]">Secondaries</span><span>Discovery pending</span></div>
				<div class="flex items-center justify-between"><span class="text-[var(--text-muted)]">Replication lag</span><span>Discovery pending</span></div>
			</div>
			<p class="mt-5 text-xs leading-5 text-[var(--text-muted)]">The UI intentionally does not fake runtime status. A later server module will populate this from MongoDB commands where permissions allow it.</p>
		</section>
	</div>
</section>
