<script lang="ts">
	let { data } = $props();
	const foilNodes = $derived(data.controlWorkspace.systemNodes);
	const foilEdges = $derived(data.controlWorkspace.systemEdges);

	let mode = $state<"infrastructure" | "data" | "mongo">("infrastructure");
	const nodeById = $derived(new Map(foilNodes.map((node) => [node.id, node])));
	const modes = [
		{ id: "infrastructure", label: "Infrastructure" },
		{ id: "data", label: "Data flow" },
		{ id: "mongo", label: "Mongo model" }
	] as const;
</script>

<section class="space-y-6">
	<div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
		<div>
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Topology</p>
			<h1 class="mt-2 text-3xl font-semibold tracking-tight">Visual system model</h1>
			<p class="mt-2 text-sm text-[var(--text-muted)]">Infrastructure, data flow and Mongo relationships stay separate.</p>
		</div>
		<div class="inline-flex rounded-lg border border-[var(--border-color)] p-1">
			{#each modes as option}
				<button type="button" onclick={() => (mode = option.id)} class={"rounded-md px-3 py-1.5 text-xs font-medium " + (mode === option.id ? "bg-[var(--hover-background)]" : "")}>{option.label}</button>
			{/each}
		</div>
	</div>

	{#if mode === "infrastructure"}
		<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
			{#each foilNodes as node}
				<div class="rounded-xl border border-[var(--border-color)] p-5">
					<p class="text-xs uppercase tracking-wide text-[var(--text-muted)]">{node.kind}</p>
					<p class="mt-2 text-lg font-semibold">{node.label}</p>
					<p class="mt-1 text-xs text-[var(--text-muted)]">{node.detail}</p>
				</div>
			{/each}
		</div>
	{:else if mode === "data"}
		<div class="space-y-3 rounded-xl border border-[var(--border-color)] p-5">
			{#each foilEdges as edge}
				<div class="grid gap-2 rounded-lg bg-[var(--hover-background)] px-4 py-3 md:grid-cols-[1fr_160px_1fr] md:items-center">
					<span class="font-medium">{nodeById.get(edge.from)?.label}</span>
					<span class="text-xs text-[var(--text-muted)]">{edge.label} -&gt;</span>
					<span class="font-medium">{nodeById.get(edge.to)?.label}</span>
				</div>
			{/each}
		</div>
	{:else}
		<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
			{#each ["turbines", "telemetry", "alerts", "simulations", "maintenance"] as collection}
				<div class="rounded-xl border border-[var(--border-color)] p-5"><p class="text-xs uppercase tracking-wide text-[var(--text-muted)]">collection</p><p class="mt-2 font-semibold">{collection}</p></div>
			{/each}
		</div>
		<p class="text-xs text-[var(--text-muted)]">Relationship inference is deliberately not implemented yet. We will derive candidate links from sampled fields, ObjectIds and validators, then let you confirm them.</p>
	{/if}
</section>
