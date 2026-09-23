<script lang="ts">
	import { invalidateAll } from "$app/navigation";

	type ReviewOperation = {
		id: string;
	};

	type ReviewPreview = {
		operationId: string;
		kind: "upsert" | "delete";
		resourceType: string;
		resourceId: string;
		before: unknown;
		after: unknown;
		changed: boolean;
		rationale?: string;
	};

	type ReviewRow = {
		id: string;
		status: "staged" | "accepted" | "rejected" | "stale";
		baseRevision: number;
		summary: string;
		source: string;
		createdAt: string;
		operations: ReviewOperation[];
		preview: ReviewPreview[];
	};

	let { data } = $props();
	const changeSets = $derived(data.changeSets as ReviewRow[]);

	const exampleProject = data.controlWorkspace.projects[0];

	let proposalText = $state(
		JSON.stringify(
			{
				schemaVersion: 1,
				id: "proposal-example",
				source: "AI",
				summary: "Preview a no-op project proposal",
				createdAt: new Date().toISOString(),
				baseRevision: data.identity.revision,
				baseFingerprint: data.identity.fingerprint,
				operations: exampleProject
					? [
							{
								id: "operation-1",
								kind: "upsert",
								resourceType: "project",
								resourceId: exampleProject.id,
								value: exampleProject,
								rationale: "No-op example that validates the ChangeSet review path."
							}
						]
					: []
			},
			null,
			2
		)
	);
	let previewResult = $state<unknown>(null);
	let message = $state("");
	let busy = $state(false);
	let selected = $state<Record<string, boolean>>({});

	function operationKey(changeSetId: string, operationId: string) {
		return changeSetId + "::" + operationId;
	}

	function selectedIds(row: ReviewRow): string[] {
		return (row.operations ?? [])
			.filter((operation) => selected[operationKey(row.id, operation.id)] !== false)
			.map((operation) => operation.id);
	}

	async function preview() {
		busy = true;
		message = "";
		try {
			const response = await fetch("/api/datapass/changesets/preview", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ changeSet: JSON.parse(proposalText) })
			});
			const result = (await response.json()) as { error?: string };
			previewResult = result;
			if (!response.ok) {
				message = result.error || "Preview failed";
			}
		} catch (error) {
			message = error instanceof Error ? error.message : "Preview failed";
		} finally {
			busy = false;
		}
	}

	async function stage() {
		busy = true;
		message = "";
		try {
			const response = await fetch("/api/datapass/changesets", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ changeSet: JSON.parse(proposalText) })
			});
			const result = await response.json();
			if (!response.ok) {
				throw new Error(result.error || "Stage failed");
			}
			message = "ChangeSet staged for review.";
			await invalidateAll();
		} catch (error) {
			message = error instanceof Error ? error.message : "Stage failed";
		} finally {
			busy = false;
		}
	}

	async function decide(row: ReviewRow, action: "accept" | "reject") {
		busy = true;
		message = "";
		try {
			const response = await fetch("/api/datapass/changesets/" + encodeURIComponent(row.id), {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					action,
					...(action === "accept" ? { selectedOperationIds: selectedIds(row) } : {})
				})
			});
			const result = await response.json();
			if (!response.ok) {
				throw new Error(result.error || "Decision failed");
			}
			message = action === "accept" ? "Selected operations accepted." : "ChangeSet rejected.";
			await invalidateAll();
		} catch (error) {
			message = error instanceof Error ? error.message : "Decision failed";
		} finally {
			busy = false;
		}
	}
</script>

<section class="space-y-6">
	<div>
		<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">AI Review</p>
		<h1 class="mt-2 text-3xl font-semibold tracking-tight">Reviewed ChangeSets</h1>
		<p class="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">
			AI proposals are validated against an exact workspace revision and fingerprint. Preview is read-only; Stage records the proposal; Accept recomputes it against the current workspace before committing.
		</p>
	</div>

	<div class="grid gap-4 md:grid-cols-3">
		<div class="rounded-xl border border-[var(--border-color)] p-4">
			<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Current revision</p>
			<p class="mt-2 text-2xl font-semibold">{data.identity.revision}</p>
		</div>
		<div class="rounded-xl border border-[var(--border-color)] p-4 md:col-span-2">
			<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Fingerprint</p>
			<p class="mt-2 break-all font-mono text-xs">{data.identity.fingerprint}</p>
		</div>
	</div>

	<section class="rounded-xl border border-[var(--border-color)]">
		<div class="border-b border-[var(--border-color)] px-4 py-3">
			<h2 class="text-sm font-semibold">Preview or stage JSON proposal</h2>
			<p class="text-[11px] text-[var(--text-muted)]">Use the capabilities endpoint to discover supported resource types and operations.</p>
		</div>
		<textarea bind:value={proposalText} rows="18" spellcheck="false" class="w-full resize-y bg-transparent p-4 font-mono text-xs leading-5 outline-none"></textarea>
		<div class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-color)] px-4 py-3">
			<p class="text-xs text-[var(--text-muted)]">{message}</p>
			<div class="flex gap-2">
				<button type="button" onclick={preview} disabled={busy} class="rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-medium disabled:opacity-50">Preview</button>
				<button type="button" onclick={stage} disabled={busy || !data.controlWritesEnabled} class="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black">Stage for review</button>
			</div>
		</div>
		{#if previewResult}
			<pre class="max-h-96 overflow-auto border-t border-[var(--border-color)] p-4 text-[11px] leading-5">{JSON.stringify(previewResult, null, 2)}</pre>
		{/if}
	</section>

	<div class="space-y-4">
		{#each changeSets as row}
			<article class="rounded-xl border border-[var(--border-color)] p-5">
				<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
					<div>
						<div class="flex flex-wrap items-center gap-2">
							<span class="rounded-full bg-[var(--hover-background)] px-2 py-0.5 text-[10px] uppercase">{row.status}</span>
							<span class="text-[10px] text-[var(--text-muted)]">base r{row.baseRevision}</span>
						</div>
						<h2 class="mt-2 text-lg font-semibold">{row.summary}</h2>
						<p class="mt-1 text-xs text-[var(--text-muted)]">{row.source} · {row.createdAt}</p>
					</div>
					{#if row.status === "staged"}
						<div class="flex gap-2">
							<button type="button" onclick={() => decide(row, "reject")} disabled={busy || !data.controlWritesEnabled} class="rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs disabled:opacity-50">Reject</button>
							<button type="button" onclick={() => decide(row, "accept")} disabled={busy || !data.controlWritesEnabled} class="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black">Accept selected</button>
						</div>
					{/if}
				</div>

				<div class="mt-4 space-y-2">
					{#each row.preview ?? [] as change}
						<label class="flex items-start gap-3 rounded-lg bg-[var(--hover-background)] p-3">
							{#if row.status === "staged"}
								<input
									type="checkbox"
									checked={selected[operationKey(row.id, change.operationId)] !== false}
									onchange={(event) => {
										selected[operationKey(row.id, change.operationId)] = (event.currentTarget as HTMLInputElement).checked;
									}}
									class="mt-0.5"
								/>
							{/if}
							<div class="min-w-0 flex-1">
								<p class="text-xs font-semibold">{change.kind} {change.resourceType} · {change.resourceId}</p>
								<p class="mt-1 text-[10px] text-[var(--text-muted)]">{change.changed ? "Changes current state" : "No semantic change"}</p>
								{#if change.rationale}<p class="mt-1 text-[11px]">{change.rationale}</p>{/if}
								<details class="mt-2">
									<summary class="cursor-pointer text-[10px] text-[var(--text-muted)]">Before / after</summary>
									<div class="mt-2 grid gap-2 xl:grid-cols-2">
										<pre class="overflow-auto rounded border border-[var(--border-color)] p-2 text-[10px]">{JSON.stringify(change.before, null, 2)}</pre>
										<pre class="overflow-auto rounded border border-[var(--border-color)] p-2 text-[10px]">{JSON.stringify(change.after, null, 2)}</pre>
									</div>
								</details>
							</div>
						</label>
					{/each}
				</div>
			</article>
		{:else}
			<div class="rounded-xl border border-dashed border-[var(--border-color)] p-8 text-sm text-[var(--text-muted)]">No reviewed AI ChangeSets yet.</div>
		{/each}
	</div>
</section>
