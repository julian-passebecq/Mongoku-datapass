<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { onMount } from "svelte";
	import type { WorkspacePreset } from "$lib/datapass/controlPlane";
	import { workspaceUi } from "$lib/stores/workspaceUi.svelte";

	let { presets } = $props<{ presets: WorkspacePreset[] }>();

	const href = $derived(page.url.pathname + page.url.search);
	const routeTitle = $derived.by(() => {
		if (page.url.pathname === "/") return "Dashboard";
		const segment = page.url.pathname.split("/").filter(Boolean).at(-1) || "Dashboard";
		return segment
			.split("-")
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(" ");
	});
	const selectedProject = $derived(page.url.searchParams.get("project") || undefined);
	const instance = $derived(workspaceUi.current());

	onMount(() => {
		workspaceUi.hydrate(presets, href, routeTitle);
	});

	$effect(() => {
		if (workspaceUi.hydrated) {
			workspaceUi.ensureTab(href, routeTitle, selectedProject);
		}
	});

	function navigate(href: string) {
		if (href.startsWith("http://") || href.startsWith("https://")) {
			window.open(href, "_blank", "noopener,noreferrer");
			return;
		}
		goto(href);
	}

	function closeTab(event: MouseEvent, tabId: string, tabHref: string) {
		event.stopPropagation();
		const wasActive = tabHref === href;
		workspaceUi.closeTab(tabId);
		if (wasActive) {
			const next = workspaceUi.current()?.tabs.at(-1);
			if (next) navigate(next.href);
		}
	}

	function createInstance() {
		const preset = presets.find((candidate) => candidate.id === instance?.presetId) || presets[0];
		const created = workspaceUi.newInstance(preset);
		const first = created?.tabs[0];
		if (first) navigate(first.href);
	}

	function applyPreset(event: Event) {
		const presetId = (event.currentTarget as HTMLSelectElement).value;
		const preset = presets.find((candidate) => candidate.id === presetId);
		if (!preset) return;
		workspaceUi.applyPreset(preset);
		const first = workspaceUi.current()?.tabs[0];
		if (first) navigate(first.href);
	}
</script>

<div class="border-b border-[var(--border-color)] bg-[var(--background-color)]">
	<div class="flex min-h-10 items-center gap-2 overflow-x-auto px-3">
		<select
			value={instance?.presetId || ""}
			onchange={applyPreset}
			class="shrink-0 rounded-md border border-[var(--border-color)] bg-transparent px-2 py-1 text-[11px]"
			title="Apply workspace preset"
		>
			<option value="">Workspace preset</option>
			{#each presets as preset}
				<option value={preset.id}>{preset.name}</option>
			{/each}
		</select>

		<select
			value={workspaceUi.activeInstanceId}
			onchange={(event) => {
				workspaceUi.setActiveInstance((event.currentTarget as HTMLSelectElement).value);
				const first = workspaceUi.current()?.tabs[0];
				if (first) navigate(first.href);
			}}
			class="shrink-0 rounded-md border border-[var(--border-color)] bg-transparent px-2 py-1 text-[11px]"
			title="Workspace instance"
		>
			{#each workspaceUi.instances as item}
				<option value={item.id}>{item.name}</option>
			{/each}
		</select>

		<button type="button" onclick={createInstance} class="shrink-0 rounded-md border border-[var(--border-color)] px-2 py-1 text-[11px] hover:bg-[var(--hover-background)]" title="Open another workspace instance">+ Workspace</button>

		<div class="h-5 w-px shrink-0 bg-[var(--border-color)]"></div>

		{#each instance?.tabs ?? [] as tab}
			<button
				type="button"
				onclick={() => navigate(tab.href)}
				class={"group flex shrink-0 items-center gap-2 rounded-t-md border border-b-0 border-[var(--border-color)] px-2.5 py-1.5 text-[11px] " + (tab.href === href ? "bg-[var(--hover-background)] font-semibold" : "")}
			>
				<span class="max-w-36 truncate">{tab.title}</span>
				<span
					role="button"
					tabindex="0"
					onclick={(event) => closeTab(event, tab.id, tab.href)}
					onkeydown={(event) => {
						if (event.key === "Enter" || event.key === " ") closeTab(event as unknown as MouseEvent, tab.id, tab.href);
					}}
					class="opacity-50 hover:opacity-100"
					aria-label={"Close " + tab.title}
				>×</span>
			</button>
		{/each}

		<div class="ml-auto flex shrink-0 gap-1">
			<button type="button" onclick={() => workspaceUi.toggleBookmark(href, routeTitle)} class="rounded-md px-2 py-1 text-[11px] hover:bg-[var(--hover-background)]" title="Bookmark current tab">☆</button>
			<button type="button" onclick={() => workspaceUi.toggleRightPanel()} class="rounded-md px-2 py-1 text-[11px] hover:bg-[var(--hover-background)]" title="Toggle right panel">Inspector</button>
		</div>
	</div>
</div>
