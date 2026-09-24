<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { workspaceUi, type WorkspaceCheckpoint } from "$lib/stores/workspaceUi.svelte";

	let title = $state("");
	let note = $state("");
	let scope = $state<"workspace" | "all">("workspace");
	let message = $state("");

	function checkpointScopeLabel(checkpoint: WorkspaceCheckpoint): string {
		if (checkpoint.scope === "workspace") {
			return "Workspace · " + (checkpoint.workspaceName || "current");
		}
		if (checkpoint.scope === "all") {
			return "All workspaces";
		}
		return "Legacy all-workspace save";
	}

	function checkpointTabCount(checkpoint: WorkspaceCheckpoint): number {
		return checkpoint.snapshot.instances.reduce(
			(count, instance) => count + instance.tabs.length,
			0,
		);
	}

	function checkpointSummary(checkpoint: WorkspaceCheckpoint): string {
		return checkpoint.snapshot.instances.length + " workspace instance(s) · " + checkpointTabCount(checkpoint) + " tab(s)";
	}

	function scopeButtonClass(value: "workspace" | "all"): string {
		return (
			"rounded-md px-3 py-1.5 text-xs " +
			(scope === value ? "bg-[var(--hover-background)] font-medium" : "")
		);
	}

	function save() {
		try {
			const checkpoint = workspaceUi.saveCheckpoint(title, note, scope);
			message = "Saved " + checkpoint.title + ".";
			title = "";
			note = "";
		} catch (error) {
			message = error instanceof Error ? error.message : "Save failed";
		}
	}

	function restore(id: string) {
		try {
			workspaceUi.restoreCheckpoint(id);
			message = "Workspace restored. Undo is available.";
			const first = workspaceUi.current()?.tabs[0];
			if (first) {
				goto(resolve(first.href));
			}
		} catch (error) {
			message = error instanceof Error ? error.message : "Restore failed";
		}
	}

	function undo() {
		try {
			workspaceUi.undoCheckpointRestore();
			message = "Restore undone.";
			const first = workspaceUi.current()?.tabs[0];
			if (first) {
				goto(resolve(first.href));
			}
		} catch (error) {
			message = error instanceof Error ? error.message : "Undo failed";
		}
	}
</script>

<section class="space-y-6">
	<div>
		<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Workspace States</p>
		<h1 class="mt-2 text-3xl font-semibold tracking-tight">Saved workspace checkpoints</h1>
		<p class="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">
			Checkpoint the current workspace or all workspaces without rolling back Mongo project data. Tabs, bookmarks and
			panel state are session state; each restore creates one automatic undo point.
		</p>
	</div>

	<div class="grid gap-4 xl:grid-cols-[1fr_0.7fr]">
		<section class="rounded-xl border border-[var(--border-color)] p-5">
			<h2 class="text-sm font-semibold">Save current state</h2>
			<div class="mt-4 grid gap-3">
				<div class="inline-flex w-fit rounded-lg border border-[var(--border-color)] p-1">
					<button
						type="button"
						onclick={() => (scope = "workspace")}
						class={scopeButtonClass("workspace")}
					>
						Current workspace
					</button>
					<button
						type="button"
						onclick={() => (scope = "all")}
						class={scopeButtonClass("all")}
					>
						All workspaces
					</button>
				</div>
				<input
					bind:value={title}
					maxlength="120"
					placeholder="Checkpoint title"
					class="rounded-lg border border-[var(--border-color)] bg-transparent px-3 py-2 text-sm"
				/>
				<textarea
					bind:value={note}
					maxlength="500"
					rows="3"
					placeholder="Progress / next step (optional)"
					class="rounded-lg border border-[var(--border-color)] bg-transparent px-3 py-2 text-sm"
				></textarea>
				<div class="flex items-center justify-between gap-3">
					<p class="text-xs text-[var(--text-muted)]">{workspaceUi.checkpoints.length} / 20 saved · {message}</p>
					<button
						type="button"
						onclick={save}
						disabled={!title.trim()}
						class="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
						>Save state</button
					>
				</div>
			</div>
		</section>

		<section class="rounded-xl border border-[var(--border-color)] p-5">
			<h2 class="text-sm font-semibold">Restore safety</h2>
			{#if workspaceUi.checkpointUndo}
				<p class="mt-3 text-xs font-medium">Before last restore</p>
				<p class="mt-1 text-[11px] text-[var(--text-muted)]">{workspaceUi.checkpointUndo.createdAt}</p>
				<button
					type="button"
					onclick={undo}
					class="mt-4 rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs">Undo last restore</button
				>
			{:else}
				<p class="mt-3 text-xs leading-5 text-[var(--text-muted)]">
					No restore undo point yet. Restoring a checkpoint creates one automatically.
				</p>
			{/if}
		</section>
	</div>

	<div class="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
		<section class="rounded-xl border border-[var(--border-color)]">
			<div class="border-b border-[var(--border-color)] px-4 py-3">
				<h2 class="text-sm font-semibold">Saved states</h2>
			</div>
			<div class="divide-y divide-[var(--border-color)]">
				{#each workspaceUi.checkpoints as checkpoint, __eachIndex0 (__eachIndex0)}
					<div class="flex items-start justify-between gap-4 px-4 py-4">
						<div>
							<p class="text-sm font-semibold">{checkpoint.title}</p>
							<p class="mt-1 text-[10px] text-[var(--text-muted)]">
								{checkpointScopeLabel(checkpoint)} · {checkpoint.createdAt}
							</p>
							{#if checkpoint.note}<p class="mt-2 text-xs">{checkpoint.note}</p>{/if}
							<p class="mt-2 text-[10px] text-[var(--text-muted)]">
								{checkpointSummary(checkpoint)}
							</p>
						</div>
						<div class="flex shrink-0 gap-2">
							<button
								type="button"
								onclick={() => restore(checkpoint.id)}
								class="rounded-md border border-[var(--border-color)] px-2 py-1 text-[10px]">Restore</button
							>
							<button
								type="button"
								onclick={() => workspaceUi.deleteCheckpoint(checkpoint.id)}
								class="rounded-md border border-[var(--border-color)] px-2 py-1 text-[10px]">Delete</button
							>
						</div>
					</div>
				{:else}
					<p class="p-4 text-xs text-[var(--text-muted)]">No workspace checkpoints yet.</p>
				{/each}
			</div>
		</section>

		<section class="rounded-xl border border-[var(--border-color)]">
			<div class="border-b border-[var(--border-color)] px-4 py-3">
				<h2 class="text-sm font-semibold">Recent activity</h2>
			</div>
			<div class="divide-y divide-[var(--border-color)]">
				{#each workspaceUi.checkpointHistory as event, __eachIndex1 (__eachIndex1)}
					<div class="px-4 py-3">
						<p class="text-xs font-medium">{event.action} · {event.title}</p>
						<p class="mt-1 text-[10px] text-[var(--text-muted)]">{event.createdAt}</p>
					</div>
				{:else}
					<p class="p-4 text-xs text-[var(--text-muted)]">No checkpoint activity.</p>
				{/each}
			</div>
		</section>
	</div>
</section>
