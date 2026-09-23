<script lang="ts">
	import { goto } from "$app/navigation";

	let { data } = $props();

	let projectId = $state(data.projectId || "");
	let selectedQueryId = $state(data.queryId);

	function openQuery() {
		const params = new URLSearchParams();
		if (selectedQueryId) {
			params.set("query", selectedQueryId);
		}
		if (projectId) {
			params.set("project", projectId);
		}
		goto("/queries?" + params.toString());
	}
</script>

<section class="space-y-6">
	<div>
		<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Queries</p>
		<h1 class="mt-2 text-3xl font-semibold tracking-tight">Saved Mongo queries</h1>
		<p class="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">
			These query definitions live in the canonical workspace JSON, so an AI can change filters, pipelines and
			presentation without editing the UI source.
		</p>
	</div>

	<div class="grid gap-6 xl:grid-cols-[320px_1fr]">
		<aside class="rounded-xl border border-[var(--border-color)] p-4">
			<div class="space-y-3">
				<div>
					<label for="query-select" class="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"
						>Query</label
					>
					<select
						id="query-select"
						bind:value={selectedQueryId}
						class="mt-1 w-full rounded-md border border-[var(--border-color)] bg-transparent px-2 py-2 text-xs"
					>
						{#each data.workspace.savedQueries as query}<option value={query.id}>{query.name}</option>{/each}
					</select>
				</div>
				<div>
					<label for="query-project" class="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"
						>Project context</label
					>
					<select
						id="query-project"
						bind:value={projectId}
						class="mt-1 w-full rounded-md border border-[var(--border-color)] bg-transparent px-2 py-2 text-xs"
					>
						<option value="">None</option>
						{#each data.workspace.projects as project}<option value={project.id}>{project.name}</option>{/each}
					</select>
				</div>
				<button
					type="button"
					onclick={openQuery}
					class="w-full rounded-md bg-black px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-black"
					>Load query</button
				>
			</div>

			<div class="mt-5 space-y-2">
				{#each data.workspace.savedQueries as query}
					<button
						type="button"
						onclick={() => {
							selectedQueryId = query.id;
							openQuery();
						}}
						class="block w-full rounded-md border border-[var(--border-color)] px-3 py-2 text-left hover:bg-[var(--hover-background)]"
					>
						<span class="block text-xs font-medium">{query.name}</span>
						<span class="mt-1 block text-[10px] text-[var(--text-muted)]"
							>{query.collection} · {query.operation} · {query.presentation}</span
						>
					</button>
				{/each}
			</div>
		</aside>

		<div class="space-y-5">
			{#if data.query}
				<section class="rounded-xl border border-[var(--border-color)] p-5">
					<div class="flex items-start justify-between gap-4">
						<div>
							<p class="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{data.query.id}</p>
							<h2 class="mt-1 text-lg font-semibold">{data.query.name}</h2>
							<p class="mt-2 text-sm text-[var(--text-muted)]">{data.query.description}</p>
						</div>
						<span class="rounded-full border border-[var(--border-color)] px-2 py-0.5 text-xs"
							>{data.query.readOnly ? "Read only" : "Write"}</span
						>
					</div>

					<div class="mt-4 grid gap-3 sm:grid-cols-3">
						<div class="rounded-lg bg-[var(--hover-background)] p-3">
							<p class="text-[10px] text-[var(--text-muted)]">Collection</p>
							<p class="mt-1 text-xs font-medium">{data.query.collection}</p>
						</div>
						<div class="rounded-lg bg-[var(--hover-background)] p-3">
							<p class="text-[10px] text-[var(--text-muted)]">Operation</p>
							<p class="mt-1 text-xs font-medium">{data.query.operation}</p>
						</div>
						<div class="rounded-lg bg-[var(--hover-background)] p-3">
							<p class="text-[10px] text-[var(--text-muted)]">Presentation</p>
							<p class="mt-1 text-xs font-medium">{data.query.presentation}</p>
						</div>
					</div>

					<pre
						class="mt-4 max-h-96 overflow-auto rounded-lg bg-[var(--hover-background)] p-4 text-[11px] leading-5">{JSON.stringify(
							data.query.operation === "find"
								? { filter: data.query.filter, sort: data.query.sort, limit: data.query.limit }
								: { pipeline: data.query.pipeline },
							null,
							2,
						)}</pre>
				</section>

				<section class="rounded-xl border border-[var(--border-color)]">
					<div class="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
						<div>
							<h2 class="text-sm font-semibold">Result preview</h2>
							<p class="text-[10px] text-[var(--text-muted)]">
								{data.workspace.metadata.source} · {data.rows.length} rows
							</p>
						</div>
					</div>
					{#if data.error}
						<p class="p-4 text-sm text-red-500">{data.error}</p>
					{:else}
						<pre class="max-h-[500px] overflow-auto p-4 text-[11px] leading-5">{JSON.stringify(
								data.rows,
								null,
								2,
							)}</pre>
					{/if}
				</section>
			{/if}
		</div>
	</div>
</section>
