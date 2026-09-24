<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { resolve } from "$app/paths";
	import type { Project, SavedMongoQuery, WorkspacePreset } from "$lib/datapass/controlPlane";
	import { workspaceUi } from "$lib/stores/workspaceUi.svelte";

	let { projects, queries, presets } = $props<{
		projects: Project[];
		queries: SavedMongoQuery[];
		presets: WorkspacePreset[];
	}>();

	let importText = $state("");
	let importMessage = $state("");

	const instance = $derived(workspaceUi.current());
	const selectedProjectId = $derived(page.url.searchParams.get("project") || instance?.defaultProjectId);
	const selectedProject = $derived(projects.find((project) => project.id === selectedProjectId));
	const relevantQueries = $derived(
		queries
			.filter((query) => {
				if (selectedProject) {
					return query.tags.includes("projects") || query.tags.includes("dashboard");
				}
				return query.tags.includes("dashboard") || query.tags.includes("projects");
			})
			.slice(0, 8),
	);

	function projectRoute(kind: "board" | "architecture" | "calendar" | "notes", projectId: string) {
		if (projectId === "foil") {
			if (kind === "board") {
				return "/foil/kanban";
			}
			if (kind === "architecture") {
				return "/foil/architecture";
			}
			if (kind === "calendar") {
				return "/foil/calendar";
			}
			return "/foil/report/FOIL_RECENT";
		}
		if (kind === "board") {
			return "/projects?project=" + projectId;
		}
		if (kind === "architecture") {
			return "/architecture?project=" + projectId;
		}
		if (kind === "calendar") {
			return "/calendar?project=" + projectId;
		}
		return "/notes?project=" + projectId;
	}

	function openHref(href: string) {
		if (href.startsWith("http://") || href.startsWith("https://")) {
			window.open(href, "_blank", "noopener,noreferrer");
		} else {
			goto(resolve(href));
		}
	}

	async function copyUiState() {
		await navigator.clipboard.writeText(workspaceUi.exportJson());
		importMessage = "UI state copied as JSON.";
	}

	function importUiState() {
		try {
			workspaceUi.importJson(importText);
			importMessage = "UI state imported.";
			importText = "";
		} catch (error) {
			importMessage = error instanceof Error ? error.message : "Import failed.";
		}
	}
</script>

{#if instance?.rightPanelOpen}
	<aside
		class="sticky top-[57px] hidden h-[calc(100vh-57px)] w-72 shrink-0 border-l border-[var(--border-color)] bg-[var(--background-color)] xl:flex xl:flex-col"
	>
		<div class="flex items-center gap-1 border-b border-[var(--border-color)] p-2">
			{#each [{ id: "context", label: "Context" }, { id: "bookmarks", label: "Marks" }, { id: "queries", label: "Queries" }, { id: "settings", label: "Settings" }] as mode, __eachIndex0 (__eachIndex0)}
				<button
					type="button"
					onclick={() => workspaceUi.setRightPanelMode(mode.id as "context" | "bookmarks" | "queries" | "settings")}
					class={"rounded-md px-2 py-1 text-[10px] font-medium " +
						(instance.rightPanelMode === mode.id ? "bg-[var(--hover-background)]" : "")}>{mode.label}</button
				>
			{/each}
			<button
				type="button"
				onclick={() => workspaceUi.toggleRightPanel()}
				class="ml-auto rounded-md px-2 py-1 text-xs hover:bg-[var(--hover-background)]">×</button
			>
		</div>

		<div class="flex-1 overflow-y-auto p-3">
			{#if instance.rightPanelMode === "context"}
				<p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Current context</p>
				{#if selectedProject}
					<div class="mt-3 rounded-lg border border-[var(--border-color)] p-3">
						<h2 class="text-sm font-semibold">{selectedProject.name}</h2>
						<p class="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">{selectedProject.summary}</p>
						<div class="mt-3 flex flex-wrap gap-1">
							{#each selectedProject.tags as tag, __eachIndex1 (__eachIndex1)}<span
									class="rounded-full bg-[var(--hover-background)] px-2 py-0.5 text-[10px]">#{tag}</span
								>{/each}
						</div>
						<div class="mt-3 space-y-1 text-[11px]">
							<button
								type="button"
								onclick={() => goto(resolve(projectRoute("board", selectedProject.id)))}
								class="block hover:underline"
								>{selectedProject.id === "foil" ? "Authoritative backlog" : "Project board"}</button
							>
							<button
								type="button"
								onclick={() => goto(resolve(projectRoute("architecture", selectedProject.id)))}
								class="block hover:underline"
								>{selectedProject.id === "foil" ? "Authority architecture" : "AI graph"}</button
							>
							<button
								type="button"
								onclick={() => goto(resolve(projectRoute("calendar", selectedProject.id)))}
								class="block hover:underline">Calendar</button
							>
							<button
								type="button"
								onclick={() => goto(resolve(projectRoute("notes", selectedProject.id)))}
								class="block hover:underline"
								>{selectedProject.id === "foil" ? "Recent authority changes" : "Notes"}</button
							>
							{#if selectedProject.githubRepo}
								<a
									href={"https://github.com/" + selectedProject.githubRepo}
									target="_blank"
									rel="noreferrer"
									class="block no-underline hover:underline">GitHub repo</a
								>
							{/if}
						</div>
					</div>
				{:else}
					<p class="mt-3 text-xs leading-5 text-[var(--text-muted)]">
						No project is pinned to this tab. Select a project or boot a project workspace preset.
					</p>
				{/if}

				<div class="mt-4">
					<p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Workspace</p>
					<p class="mt-2 text-xs font-medium">{instance.name}</p>
					<p class="mt-1 text-[11px] text-[var(--text-muted)]">
						{instance.tabs.length} tabs · {instance.bookmarks.length} bookmarks
					</p>
				</div>
			{:else if instance.rightPanelMode === "bookmarks"}
				<p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Bookmarks</p>
				<div class="mt-3 space-y-2">
					{#each instance.bookmarks as bookmark, __eachIndex2 (__eachIndex2)}
						<button
							type="button"
							onclick={() => openHref(bookmark.href)}
							class="block w-full rounded-md border border-[var(--border-color)] px-3 py-2 text-left text-xs hover:bg-[var(--hover-background)]"
							>{bookmark.title}</button
						>
					{:else}
						<p class="text-xs text-[var(--text-muted)]">No bookmarks in this workspace instance.</p>
					{/each}
				</div>
			{:else if instance.rightPanelMode === "queries"}
				<p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Useful queries</p>
				<div class="mt-3 space-y-2">
					{#each relevantQueries as query, __eachIndex3 (__eachIndex3)}
						<button
							type="button"
							onclick={() =>
								goto(resolve("/queries?query=" + query.id + (selectedProject ? "&project=" + selectedProject.id : "")))}
							class="block w-full rounded-md border border-[var(--border-color)] px-3 py-2 text-left"
						>
							<span class="block text-xs font-medium">{query.name}</span>
							<span class="mt-1 block text-[10px] text-[var(--text-muted)]">{query.collection} · {query.operation}</span
							>
						</button>
					{/each}
				</div>
			{:else}
				<p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Workspace settings</p>
				<div class="mt-3 space-y-3">
					<div>
						<label class="text-[10px] text-[var(--text-muted)]" for="inspector-preset">Preset</label>
						<select
							id="inspector-preset"
							class="mt-1 w-full rounded-md border border-[var(--border-color)] bg-transparent px-2 py-1.5 text-xs"
							value={instance.presetId || ""}
							onchange={(event) => {
								const preset = presets.find(
									(candidate) => candidate.id === (event.currentTarget as HTMLSelectElement).value,
								);
								if (preset) {
									workspaceUi.applyPreset(preset);
								}
							}}
						>
							<option value="">Custom</option>
							{#each presets as preset, __eachIndex4 (__eachIndex4)}<option value={preset.id}>{preset.name}</option
								>{/each}
						</select>
					</div>

					<div class="grid grid-cols-3 gap-1">
						<button
							type="button"
							onclick={() => goto(resolve("/ai-review"))}
							class="rounded-md border border-[var(--border-color)] px-2 py-1.5 text-[10px] hover:bg-[var(--hover-background)]"
							>AI Review</button
						>
						<button
							type="button"
							onclick={() => goto(resolve("/history"))}
							class="rounded-md border border-[var(--border-color)] px-2 py-1.5 text-[10px] hover:bg-[var(--hover-background)]"
							>History</button
						>
						<button
							type="button"
							onclick={() => goto(resolve("/workspace-states"))}
							class="rounded-md border border-[var(--border-color)] px-2 py-1.5 text-[10px] hover:bg-[var(--hover-background)]"
							>States</button
						>
					</div>

					<button
						type="button"
						onclick={copyUiState}
						class="w-full rounded-md border border-[var(--border-color)] px-3 py-2 text-xs hover:bg-[var(--hover-background)]"
						>Copy UI state JSON</button
					>

					<textarea
						bind:value={importText}
						rows="8"
						class="w-full rounded-md border border-[var(--border-color)] bg-transparent p-2 font-mono text-[10px]"
						placeholder="Paste UI-state JSON"
					></textarea>
					<button
						type="button"
						onclick={importUiState}
						disabled={!importText}
						class="w-full rounded-md border border-[var(--border-color)] px-3 py-2 text-xs hover:bg-[var(--hover-background)] disabled:opacity-50"
						>Import UI state</button
					>

					{#if importMessage}<p class="text-[10px] leading-4 text-[var(--text-muted)]">{importMessage}</p>{/if}
				</div>
			{/if}
		</div>
	</aside>
{/if}
