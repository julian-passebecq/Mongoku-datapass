<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { workspaceUi } from "$lib/stores/workspaceUi.svelte";

	const project = $derived(page.url.searchParams.get("project"));

	const tools = $derived([
		{ label: "Dashboard", href: "/" },
		{ label: "Projects", href: project ? "/projects?project=" + project : "/projects" },
		{ label: "Calendar", href: project ? "/calendar?project=" + project : "/calendar" },
		{ label: "Notes", href: project ? "/notes?project=" + project : "/notes" },
		{ label: "Queries", href: "/queries" },
		{ label: "AI Review", href: "/ai-review" },
		{ label: "History", href: "/history" },
		{ label: "States", href: "/workspace-states" },
		{ label: "AI JSON", href: "/ai-json" },
		{ label: "Mongo", href: "/servers" }
	]);
</script>

<div class="border-b border-[var(--border-color)] bg-[var(--background-color)] px-3 py-1.5">
	<div class="flex items-center gap-1 overflow-x-auto">
		<span class="mr-1 shrink-0 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Tools</span>
		{#each tools as tool}
			<a href={resolve(tool.href)} class="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium no-underline hover:bg-[var(--hover-background)]">{tool.label}</a>
		{/each}
		<div class="ml-auto flex shrink-0 gap-1">
			<button type="button" onclick={() => workspaceUi.setRightPanelMode("bookmarks")} class="rounded-md px-2 py-1 text-[11px] hover:bg-[var(--hover-background)]">Bookmarks</button>
			<button type="button" onclick={() => workspaceUi.setRightPanelMode("settings")} class="rounded-md px-2 py-1 text-[11px] hover:bg-[var(--hover-background)]">Settings</button>
		</div>
	</div>
</div>
