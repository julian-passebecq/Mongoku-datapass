<script lang="ts">
	import { resolve } from "$app/paths";
	import { onMount } from "svelte";

	let { data } = $props();

	let jsonText = $state("");
	let loading = $state(true);
	let saving = $state(false);
	let message = $state("");
	let isError = $state(false);

	const endpoint = resolve("/api/datapass/workspace");

	async function loadWorkspace() {
		loading = true;
		message = "";
		isError = false;

		try {
			const response = await fetch(endpoint, { cache: "no-store" });
			if (!response.ok) {
				throw new Error("Workspace export failed");
			}
			const workspace = await response.json();
			jsonText = JSON.stringify(workspace, null, 2);
		} catch (error) {
			isError = true;
			message = error instanceof Error ? error.message : "Workspace export failed";
		} finally {
			loading = false;
		}
	}

	async function saveWorkspace(mode: "merge" | "replace") {
		message = "";
		isError = false;
		saving = true;

		try {
			const workspace = JSON.parse(jsonText);
			const payload = {
				mode,
				workspace,
				...(mode === "replace" ? { confirmReplace: "replace-workspace" } : {}),
			};

			const response = await fetch(endpoint, {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload),
			});

			const result = await response.json();
			if (!response.ok) {
				throw new Error(result.error || "Workspace import failed");
			}

			message = mode === "merge" ? "Workspace merged into Mongo." : "Workspace replaced in Mongo.";
			await loadWorkspace();
		} catch (error) {
			isError = true;
			message = error instanceof Error ? error.message : "Workspace import failed";
		} finally {
			saving = false;
		}
	}

	async function copyJson() {
		await navigator.clipboard.writeText(jsonText);
		message = "JSON copied.";
		isError = false;
	}

	function downloadJson() {
		const blob = new Blob([jsonText], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = "datapass-mongo-control.workspace.json";
		anchor.click();
		URL.revokeObjectURL(url);
	}

	function loadFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) {
			return;
		}

		const reader = new FileReader();
		reader.onload = () => {
			jsonText = String(reader.result || "");
			message = "JSON file loaded locally. Review it before merging.";
			isError = false;
		};
		reader.onerror = () => {
			message = "Could not read JSON file.";
			isError = true;
		};
		reader.readAsText(file);
	}

	onMount(loadWorkspace);
</script>

<section class="space-y-6">
	<div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
		<div>
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">AI control</p>
			<h1 class="mt-2 text-3xl font-semibold tracking-tight">Workspace JSON</h1>
			<p class="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">
				This is the canonical machine-readable representation of the control plane: projects, subprojects, Kanban
				states, work items, tags, agent graph, instruction profiles, saved Mongo queries, workspace presets and system
				graph.
			</p>
			<p class="mt-2 text-xs text-[var(--text-muted)]">
				Mongo writes: {data.controlWritesEnabled ? "enabled" : "disabled (export/read-only mode)"} · AI changes should normally
				go through reviewed ChangeSets.
			</p>
		</div>

		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				onclick={loadWorkspace}
				disabled={loading || saving}
				class="rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-medium hover:bg-[var(--hover-background)] disabled:opacity-50"
				>Reload</button
			>
			<button
				type="button"
				onclick={copyJson}
				disabled={loading || !jsonText}
				class="rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-medium hover:bg-[var(--hover-background)] disabled:opacity-50"
				>Copy JSON</button
			>
			<button
				type="button"
				onclick={downloadJson}
				disabled={loading || !jsonText}
				class="rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-medium hover:bg-[var(--hover-background)] disabled:opacity-50"
				>Download</button
			>
			<label
				class="cursor-pointer rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-medium hover:bg-[var(--hover-background)]"
			>
				Load file
				<input type="file" accept="application/json,.json" onchange={loadFile} class="hidden" />
			</label>
		</div>
	</div>

	<div class="grid gap-4 lg:grid-cols-4">
		<div class="rounded-xl border border-[var(--border-color)] p-4">
			<p class="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Schema</p>
			<p class="mt-2 text-sm font-semibold">Workspace v1</p>
		</div>
		<div class="rounded-xl border border-[var(--border-color)] p-4">
			<p class="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Normal AI edit</p>
			<p class="mt-2 text-sm font-semibold">Reviewed ChangeSet</p>
		</div>
		<div class="rounded-xl border border-[var(--border-color)] p-4">
			<p class="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Destructive edit</p>
			<p class="mt-2 text-sm font-semibold">Explicit replace only</p>
		</div>
		<div class="rounded-xl border border-[var(--border-color)] p-4">
			<p class="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Queries</p>
			<p class="mt-2 text-sm font-semibold">Read-only + JSON-defined</p>
		</div>
	</div>

	<div class="rounded-xl border border-[var(--border-color)]">
		<div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] px-4 py-3">
			<div>
				<h2 class="text-sm font-semibold">Editable workspace document</h2>
				<p class="text-[11px] text-[var(--text-muted)]">
					Credentials and Mongo connection strings are deliberately excluded.
				</p>
			</div>
			<div class="flex gap-3 text-xs">
				<a href="/ai-review" class="no-underline hover:underline">AI Review</a>
				<a href="/api/datapass/capabilities" target="_blank" rel="noreferrer" class="no-underline hover:underline"
					>Capabilities</a
				>
				<a href={endpoint} target="_blank" rel="noreferrer" class="no-underline hover:underline">Raw API</a>
			</div>
		</div>

		<textarea
			bind:value={jsonText}
			spellcheck="false"
			class="min-h-[620px] w-full resize-y bg-transparent p-4 font-mono text-xs leading-5 outline-none"
			placeholder={loading ? "Loading workspace…" : "Workspace JSON"}
		></textarea>

		<div class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-color)] px-4 py-3">
			<div class:text-red-500={isError} class="text-xs text-[var(--text-muted)]">
				{message ||
					"Reviewed ChangeSets are the default AI path. Direct JSON commit is for trusted manual administration."}
			</div>
			<div class="flex gap-2">
				<button
					type="button"
					onclick={() => saveWorkspace("merge")}
					disabled={saving || loading || !jsonText || !data.controlWritesEnabled}
					class="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
				>
					{saving ? "Saving…" : "Direct JSON commit"}
				</button>
				<button
					type="button"
					onclick={() => saveWorkspace("replace")}
					disabled={saving || loading || !jsonText || !data.controlWritesEnabled}
					class="rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-medium hover:bg-[var(--hover-background)] disabled:opacity-50"
				>
					Replace workspace
				</button>
			</div>
		</div>
	</div>

	<div class="rounded-xl border border-[var(--border-color)] p-5">
		<h2 class="font-semibold">AI usage</h2>
		<p class="mt-2 text-sm leading-6 text-[var(--text-muted)]">
			An AI should GET the workspace and capabilities, create a ChangeSet against the returned revision/fingerprint,
			preview it, stage it, and wait for explicit acceptance. Direct PUT remains available for trusted manual
			administration and initialization. Saved query execution remains read-only.
		</p>
	</div>
</section>
