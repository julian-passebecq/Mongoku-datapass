<script lang="ts">
	import { goto, invalidateAll } from "$app/navigation";

	let { data } = $props();

	let left = $state(String(data.left ?? ""));
	let right = $state(String(data.right ?? ""));
	let message = $state("");
	let busy = $state(false);

	function compare() {
		const params = new URLSearchParams();
		if (left) {
			params.set("left", left);
		}
		if (right) {
			params.set("right", right);
		}
		goto("/history?" + params.toString());
	}

	async function restore(revision: number) {
		busy = true;
		message = "";
		try {
			const response = await fetch("/api/datapass/history/restore", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					revision,
					expectedRevision: data.identity.revision,
					expectedFingerprint: data.identity.fingerprint
				})
			});
			const result = await response.json();
			if (!response.ok) {
				throw new Error(result.error || "Restore failed");
			}
			message = "Revision restored as a new current revision.";
			await invalidateAll();
		} catch (error) {
			message = error instanceof Error ? error.message : "Restore failed";
		} finally {
			busy = false;
		}
	}
</script>

<section class="space-y-6">
	<div>
		<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">History</p>
		<h1 class="mt-2 text-3xl font-semibold tracking-tight">Revision history & A/B compare</h1>
		<p class="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">
			Accepted AI changes and direct JSON commits append immutable snapshots. Restoring an older snapshot creates a new revision instead of deleting later history.
		</p>
	</div>

	<div class="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border-color)] p-4">
		<label class="text-xs">
			<span class="block text-[10px] uppercase text-[var(--text-muted)]">A</span>
			<select bind:value={left} class="mt-1 rounded-md border border-[var(--border-color)] bg-transparent px-2 py-2">
				{#each data.revisions as revision}<option value={revision.revision}>r{revision.revision} · {revision.summary}</option>{/each}
			</select>
		</label>
		<label class="text-xs">
			<span class="block text-[10px] uppercase text-[var(--text-muted)]">B</span>
			<select bind:value={right} class="mt-1 rounded-md border border-[var(--border-color)] bg-transparent px-2 py-2">
				{#each data.revisions as revision}<option value={revision.revision}>r{revision.revision} · {revision.summary}</option>{/each}
			</select>
		</label>
		<button type="button" onclick={compare} disabled={!left || !right} class="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-black">Compare</button>
		<span class="ml-auto text-xs text-[var(--text-muted)]">{message}</span>
	</div>

	{#if data.comparison}
		<div class="grid gap-5 xl:grid-cols-2">
			<section class="rounded-xl border border-[var(--border-color)]">
				<div class="border-b border-[var(--border-color)] px-4 py-3"><h2 class="text-sm font-semibold">A · revision {data.comparison.left.revision}</h2></div>
				<pre class="max-h-[540px] overflow-auto p-4 text-[10px] leading-5">{JSON.stringify(data.comparison.left.workspace, null, 2)}</pre>
			</section>
			<section class="rounded-xl border border-[var(--border-color)]">
				<div class="border-b border-[var(--border-color)] px-4 py-3"><h2 class="text-sm font-semibold">B · revision {data.comparison.right.revision}</h2></div>
				<pre class="max-h-[540px] overflow-auto p-4 text-[10px] leading-5">{JSON.stringify(data.comparison.right.workspace, null, 2)}</pre>
			</section>
		</div>

		<section class="rounded-xl border border-[var(--border-color)]">
			<div class="border-b border-[var(--border-color)] px-4 py-3">
				<h2 class="text-sm font-semibold">Semantic paths changed</h2>
				<p class="text-[10px] text-[var(--text-muted)]">{data.comparison.changes.length} displayed</p>
			</div>
			<div class="divide-y divide-[var(--border-color)]">
				{#each data.comparison.changes as change}
					<div class="grid gap-2 px-4 py-3 xl:grid-cols-[220px_1fr_1fr]">
						<code class="text-[10px]">{change.path || "(root)"}</code>
						<pre class="overflow-auto text-[10px]">{JSON.stringify(change.before, null, 2)}</pre>
						<pre class="overflow-auto text-[10px]">{JSON.stringify(change.after, null, 2)}</pre>
					</div>
				{:else}
					<p class="p-4 text-xs text-[var(--text-muted)]">No canonical revisions yet. Initialize the control database or accept a reviewed ChangeSet first.</p>
				{/each}
			</div>
		</section>
	{/if}

	<div class="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
		<section class="rounded-xl border border-[var(--border-color)]">
			<div class="border-b border-[var(--border-color)] px-4 py-3"><h2 class="text-sm font-semibold">Revisions</h2></div>
			<div class="divide-y divide-[var(--border-color)]">
				{#each data.revisions as revision}
					<div class="flex items-start justify-between gap-4 px-4 py-3">
						<div>
							<p class="text-xs font-semibold">r{revision.revision} · {revision.summary}</p>
							<p class="mt-1 text-[10px] text-[var(--text-muted)]">{revision.source} · {revision.createdAt}</p>
							<p class="mt-1 break-all font-mono text-[9px] text-[var(--text-muted)]">{revision.fingerprint}</p>
						</div>
						<button type="button" onclick={() => restore(revision.revision)} disabled={busy || !data.controlWritesEnabled || revision.revision === data.identity.revision} class="shrink-0 rounded-md border border-[var(--border-color)] px-2 py-1 text-[10px] disabled:opacity-40">Restore as new</button>
					</div>
				{/each}
			</div>
		</section>

		<section class="rounded-xl border border-[var(--border-color)]">
			<div class="border-b border-[var(--border-color)] px-4 py-3"><h2 class="text-sm font-semibold">Activity</h2></div>
			<div class="divide-y divide-[var(--border-color)]">
				{#each data.activity as event}
					<div class="px-4 py-3">
						<p class="text-xs font-medium">{event.action}</p>
						<p class="mt-1 text-[11px]">{event.summary}</p>
						<p class="mt-1 text-[10px] text-[var(--text-muted)]">r{event.revision} · {event.source} · {event.createdAt}</p>
					</div>
				{:else}
					<p class="p-4 text-xs text-[var(--text-muted)]">No activity recorded yet.</p>
				{/each}
			</div>
		</section>
	</div>
</section>
