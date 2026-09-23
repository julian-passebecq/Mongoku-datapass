<script lang="ts">
	import { base } from "$app/paths";
	import { page } from "$app/state";
	import { workspaceUi } from "$lib/stores/workspaceUi.svelte";

	const project = $derived(page.url.searchParams.get("project"));
	const foilMode = $derived(page.url.pathname.startsWith("/foil") || project === "foil");

	const globalTools = $derived([
		{ label: "Dashboard", href: "/" },
		{ label: "Projects", href: project ? "/projects?project=" + project : "/projects" },
		{ label: "Calendar", href: project ? "/calendar?project=" + project : "/calendar" },
		{ label: "Notes", href: project ? "/notes?project=" + project : "/notes" },
		{ label: "Queries", href: "/queries" },
		{ label: "AI Review", href: "/ai-review" },
		{ label: "History", href: "/history" },
		{ label: "States", href: "/workspace-states" },
		{ label: "AI JSON", href: "/ai-json" },
		{ label: "Mongo", href: "/servers" },
	]);

	const foilTools = [
		{ label: "FOIL Home", href: "/foil" },
		{ label: "Status", href: "/foil/report/FOIL_STATUS_NOW" },
		{ label: "Next", href: "/foil/kanban" },
		{ label: "Recent", href: "/foil/report/FOIL_RECENT" },
		{ label: "Impact", href: "/foil/propagation" },
		{ label: "Questions", href: "/foil/questions" },
		{ label: "Maintenance", href: "/foil/calendar" },
		{ label: "Apps", href: "/foil/report/FOIL_APPS_IMPACTED" },
		{ label: "P0 blockers", href: "/foil/report/FOIL_P0_BLOCKERS" },
		{ label: "Contradictions", href: "/foil/report/FOIL_CONTRADICTIONS" },
		{ label: "Architecture", href: "/foil/architecture" },
		{ label: "Documents", href: "/foil/documents" },
		{ label: "Resources", href: "/foil/resources" },
		{ label: "Audit status", href: "/foil/report/FOIL_MAINTENANCE_DUE" },
		{ label: "Instruction drift", href: "/foil/report/FOIL_INSTRUCTION_DRIFT" },
	];

	const tools = $derived(foilMode ? foilTools : globalTools);
</script>

<div class="border-b border-[var(--border-color)] bg-[var(--background-color)] px-3 py-1.5">
	<div class="flex items-center gap-1 overflow-x-auto">
		<a
			href={base + (foilMode ? "/foil" : "/")}
			class="mr-1 shrink-0 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)] no-underline"
		>
			{foilMode ? "FOIL" : "Tools"}
		</a>
		{#each tools as tool, __eachIndex0 (__eachIndex0)}
			<a
				href={base + tool.href}
				class="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium no-underline hover:bg-[var(--hover-background)]"
				>{tool.label}</a
			>
		{/each}
		<div class="ml-auto flex shrink-0 gap-1">
			{#if foilMode}
				<a href={base + "/"} class="rounded-md px-2 py-1 text-[11px] no-underline hover:bg-[var(--hover-background)]"
					>Global</a
				>
			{/if}
			<button
				type="button"
				onclick={() => workspaceUi.setRightPanelMode("bookmarks")}
				class="rounded-md px-2 py-1 text-[11px] hover:bg-[var(--hover-background)]">Bookmarks</button
			>
			<button
				type="button"
				onclick={() => workspaceUi.setRightPanelMode("settings")}
				class="rounded-md px-2 py-1 text-[11px] hover:bg-[var(--hover-background)]">Settings</button
			>
		</div>
	</div>
</div>
