<script lang="ts">
	import { resolve } from "$app/paths";
	import { createPortal } from "$lib/actions/portal";
	import Breadcrumbs from "$lib/components/Breadcrumbs.svelte";
	import Notifications from "$lib/components/Notifications.svelte";
	import OriginWarning from "$lib/components/OriginWarning.svelte";
	import PageSwitcher from "$lib/components/PageSwitcher.svelte";
	import ProjectRail from "$lib/components/ProjectRail.svelte";
	import RightInspector from "$lib/components/RightInspector.svelte";
	import ToolRibbon from "$lib/components/ToolRibbon.svelte";
	import WorkspaceTabs from "$lib/components/WorkspaceTabs.svelte";
	import ThemeSwitcher from "$lib/components/ThemeSwitcher.svelte";
	import { breadcrumbs } from "$lib/stores/breadcrumbs.svelte";
	import "../app.css";

	let { children, data } = $props();

	const pageTitle = $derived.by(() => {
		const items = breadcrumbs.items.slice(-2).reverse();

		if (items.length === 0) {
			return "Datapass Mongo Control";
		}

		return items.map((b) => b.label).join(" - ") + " - Datapass Mongo Control";
	});

	const nav = [
		{ href: "/", label: "Home" },
		{ href: "/projects", label: "Projects" },
		{ href: "/architecture", label: "AI Graph" },
		{ href: "/foil", label: "FOIL" },
		{ href: "/topology", label: "Systems" },
		{ href: "/instructions", label: "Instructions" },
		{ href: "/ai-json", label: "AI JSON" },
		{ href: "/servers", label: "Mongo Explorer" },
	];
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<div style="min-height: 100vh">
	<header class="sticky top-0 z-50 border-b border-[var(--border-color)] bg-[var(--background-color)]/90 backdrop-blur">
		<div class="mx-auto max-w-[110rem] px-4 sm:px-6 lg:px-8">
			<div class="flex min-h-14 items-center gap-3">
				<a href={resolve("/")} class="inline-flex items-center gap-2 no-underline hover:no-underline">
					<span
						class="inline-flex h-7 w-7 select-none items-center justify-center rounded-md bg-black text-sm font-semibold text-white dark:bg-white dark:text-black"
						>D</span
					>
					<span class="hidden text-base font-semibold tracking-tight sm:inline" style="color: var(--text);"
						>Mongo Control</span
					>
				</a>

				<div class="hidden h-5 w-px bg-[var(--border-color)] md:block"></div>

				<nav class="hidden items-center gap-1 xl:flex">
					{#each nav as item, __eachIndex0 (__eachIndex0)}
						<a
							href={resolve(item.href)}
							class="rounded-md px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] no-underline transition-colors hover:bg-[var(--hover-background)] hover:text-[var(--text)]"
							>{item.label}</a
						>
					{/each}
				</nav>

				<div class="hidden 2xl:block">
					<Breadcrumbs />
				</div>

				<div class="ml-auto flex items-center gap-2">
					<PageSwitcher class="" />
					<ThemeSwitcher />
					{#if data.oauthEnabled && data.user}
						<div class="hidden h-5 w-px bg-[var(--border-color)] md:block"></div>
						<div class="flex items-center gap-1.5">
							<span class="hidden max-w-32 truncate text-xs text-[var(--text-muted)] md:inline" title={data.user.email}
								>{data.user.name || data.user.email || "User"}</span
							>
							<form method="POST" action={resolve("/auth/logout")}>
								<button
									type="submit"
									class="inline-flex cursor-pointer items-center justify-center rounded-md px-2 py-1 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-background)] hover:text-[var(--text)]"
									>Log out</button
								>
							</form>
						</div>
					{/if}
				</div>
			</div>

			<nav class="flex gap-1 overflow-x-auto pb-2 xl:hidden">
				{#each nav as item, __eachIndex1 (__eachIndex1)}
					<a
						href={resolve(item.href)}
						class="whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] no-underline hover:bg-[var(--hover-background)] hover:text-[var(--text)]"
						>{item.label}</a
					>
				{/each}
			</nav>
		</div>
	</header>

	<OriginWarning serverOrigin={data.serverOrigin} readOnly={data.readOnly} />
	{#if data.controlWorkspace.metadata.sourceMode && data.controlWorkspace.metadata.sourceMode !== "workspace-v1"}
		<div
			class="border-b border-[var(--border-color)] px-4 py-2 text-center text-xs text-[var(--text-muted)]"
			class:bg-amber-50={data.controlWorkspace.metadata.sourceMode === "fallback-error"}
			class:dark:bg-amber-950={data.controlWorkspace.metadata.sourceMode === "fallback-error"}
		>
			Control source: <strong>{data.controlWorkspace.metadata.sourceMode}</strong>
			{#if data.controlWorkspace.metadata.warning}
				<span> — {data.controlWorkspace.metadata.warning}</span>
			{/if}
		</div>
	{/if}
	<WorkspaceTabs presets={data.controlWorkspace.workspacePresets} />
	<ToolRibbon />

	<div class="flex min-h-[calc(100vh-57px)]">
		<ProjectRail projects={data.controlWorkspace.projects} />

		<main class="min-w-0 flex-1 px-4 py-6 sm:px-6 md:py-10 lg:px-8">
			<div class="mx-auto max-w-[96rem]">
				<Notifications />
				<div class="flex flex-col gap-6">
					{@render children()}
				</div>
			</div>
		</main>

		<RightInspector
			projects={data.controlWorkspace.projects}
			queries={data.controlWorkspace.savedQueries}
			presets={data.controlWorkspace.workspacePresets}
		/>
	</div>

	<div use:createPortal></div>
</div>
