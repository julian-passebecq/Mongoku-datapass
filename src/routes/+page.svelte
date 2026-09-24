<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import Modal from "$lib/components/Modal.svelte";
	import {
		buildProjectContext,
		contextToMarkdown,
		type ContextPurpose,
		type PortfolioContext,
	} from "$lib/datapass/aiContext";
	import { buildCockpit, isDoneStatus, type CockpitProject, type WorkCard } from "$lib/datapass/cockpit";
	import type { ReportResult } from "$lib/datapass/reporting";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import { SvelteMap, SvelteSet } from "svelte/reactivity";

	let { data } = $props();
	const reports = $derived(data.reports as ReportResult[]);
	const globalReport = $derived(reports.find((item) => item.reportId === "GLOBAL_PROJECTS"));
	const foilReport = $derived(reports.find((item) => item.reportId === "FOIL_STATUS_NOW"));

	const sectionRows = (report: ReportResult | undefined, id: string) =>
		report?.sections.find((section) => section.id === id)?.rows ?? [];

	const organizations = $derived(sectionRows(globalReport, "organizations"));
	const entities = $derived(sectionRows(globalReport, "entities"));
	const relationships = $derived(sectionRows(globalReport, "relationships"));
	const globalWork = $derived(sectionRows(globalReport, "work"));
	const repositories = $derived(sectionRows(globalReport, "repositories"));
	const events = $derived(sectionRows(globalReport, "events"));
	const foilScorecards = $derived(sectionRows(foilReport, "scorecards"));
	const foilP0 = $derived(sectionRows(foilReport, "p0"));

	const cockpit = $derived(buildCockpit({ organizations, entities, repositories, work: globalWork, events }));
	const cockpitById = $derived(new Map(cockpit.projects.map((project) => [project.id, project])));

	function text(row: Record<string, unknown>, key: string): string {
		const value = row[key];
		return value == null ? "" : String(value);
	}

	function entityId(row: Record<string, unknown>): string {
		return text(row, "entity_id") || text(row, "id") || text(row, "_id");
	}

	let selectedCategory = $state(page.url.searchParams.get("category") || "all");
	let selectedReadiness = $state(page.url.searchParams.get("readiness") || "all");
	const selectedOrganization = $derived(page.url.searchParams.get("org") || "all");
	const focusProject = $derived(page.url.searchParams.get("project") || "");

	const categories = $derived(
		Array.from(new Set(entities.map((entity) => text(entity, "category")).filter(Boolean))).sort(),
	);
	const readinessValues = $derived(
		Array.from(new Set(entities.map((entity) => text(entity, "test_readiness")).filter(Boolean))).sort(),
	);

	function inOrganization(entity: Record<string, unknown>): boolean {
		const organizationId = text(entity, "organization_id");
		if (selectedOrganization === "all") {
			return true;
		}
		if (selectedOrganization === "independent") {
			return !organizationId;
		}
		return organizationId === selectedOrganization;
	}

	const visibleEntities = $derived(
		entities.filter(
			(entity) =>
				inOrganization(entity) &&
				(!focusProject || entityId(entity) === focusProject) &&
				(selectedCategory === "all" || text(entity, "category") === selectedCategory) &&
				(selectedReadiness === "all" || text(entity, "test_readiness") === selectedReadiness),
		),
	);

	function hierarchyRows(rows: Record<string, unknown>[]) {
		const byParent = new SvelteMap<string, Record<string, unknown>[]>();
		const knownIds = new SvelteSet(rows.map((row) => entityId(row)));
		for (const row of rows) {
			const parentId = text(row, "parent_entity_id");
			const key = parentId && knownIds.has(parentId) ? parentId : "";
			const bucket = byParent.get(key) ?? [];
			bucket.push(row);
			byParent.set(key, bucket);
		}
		for (const bucket of byParent.values()) {
			bucket.sort((a, b) => (text(a, "name") || entityId(a)).localeCompare(text(b, "name") || entityId(b)));
		}
		const flattened: Array<{ row: Record<string, unknown>; depth: number }> = [];
		const visited = new SvelteSet<string>();
		const append = (parentId: string, depth: number) => {
			for (const row of byParent.get(parentId) ?? []) {
				const id = entityId(row);
				if (!id || visited.has(id)) {
					continue;
				}
				visited.add(id);
				flattened.push({ row, depth });
				append(id, depth + 1);
			}
		};
		append("", 0);
		for (const row of rows) {
			const id = entityId(row);
			if (id && !visited.has(id)) {
				flattened.push({ row, depth: 0 });
			}
		}
		return flattened;
	}

	const visibleHierarchy = $derived(hierarchyRows(visibleEntities));
	const visibleEntityIds = $derived(new Set(visibleEntities.map((entity) => entityId(entity))));
	const unfiltered = $derived(
		selectedOrganization === "all" && !focusProject && selectedCategory === "all" && selectedReadiness === "all",
	);
	/** Work attached to a project id with no entity (for example `portfolio`) is shown only without filters. */
	const inScope = (projectId: string) => unfiltered || visibleEntityIds.has(projectId);

	const visibleRelationships = $derived(
		relationships.filter(
			(relationship) =>
				visibleEntityIds.has(text(relationship, "from_id")) && visibleEntityIds.has(text(relationship, "to_id")),
		),
	);
	const visibleGlobalWork = $derived(globalWork.filter((item) => inScope(text(item, "project_id"))));
	/** The report only excludes literal done/closed; green/mitigated rows are finished too. */
	const openGlobalWork = $derived(visibleGlobalWork.filter((item) => !isDoneStatus(text(item, "status"))));

	const scopedCards = (cards: WorkCard[]) => cards.filter((card) => inScope(card.projectId));
	const scopedProjects = (projects: CockpitProject[]) => projects.filter((project) => visibleEntityIds.has(project.id));

	const today = $derived(scopedCards(cockpit.today));
	const readyToTest = $derived(scopedCards(cockpit.readyToTest));
	const blocked = $derived(scopedCards(cockpit.blocked));
	const resume = $derived(scopedProjects(cockpit.resume));
	const websites = $derived(scopedProjects(cockpit.websites));
	const knowledge = $derived(scopedProjects(cockpit.knowledge));
	const recent = $derived(cockpit.recent.filter((event) => inScope(event.projectId ?? "")));
	const reconciliation = $derived(
		cockpit.reconciliation.filter((finding) => unfiltered || finding.refs.some((ref) => visibleEntityIds.has(ref))),
	);

	const globalWorkColumns = [
		{ id: "actionable", label: "Actionable" },
		{ id: "blocked", label: "Blocked / waiting" },
		{ id: "verify", label: "Verify" },
		{ id: "other", label: "Later / other" },
	] as const;

	function organizationHref(organizationId: string): string {
		return organizationId === "all" ? "/" : "/?org=" + organizationId;
	}

	function organizationClass(organizationId: string): string {
		const active = selectedOrganization === organizationId;
		return (
			"rounded-full border px-3 py-1.5 text-xs no-underline " +
			(active
				? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
				: "border-[var(--border-color)]")
		);
	}

	function workBucket(item: Record<string, unknown>): "actionable" | "blocked" | "verify" | "other" {
		const status = text(item, "status").toLowerCase();
		if (/block|hold|wait/.test(status)) {
			return "blocked";
		}
		if (/verify|review|unknown/.test(status)) {
			return "verify";
		}
		if (/ready|ongoing|open|active|todo|in_progress/.test(status)) {
			return "actionable";
		}
		return "other";
	}

	function scheduledAt(item: Record<string, unknown>): string {
		return (
			text(item, "due_at") ||
			text(item, "dueDate") ||
			text(item, "next_review_at") ||
			text(item, "nextReviewAt") ||
			text(item, "targetReviewDate")
		);
	}

	const scheduledGlobalWork = $derived(
		visibleGlobalWork.filter((item) => scheduledAt(item)).sort((a, b) => scheduledAt(a).localeCompare(scheduledAt(b))),
	);

	const globalTrace = $derived(globalReport?.sections.find((section) => section.id === "entities")?.trace);
	const sourceAvailable = $derived(globalReport?.sections.some((section) => section.trace.resolved) ?? false);
	const foilSourceAvailable = $derived(foilReport?.sections.some((section) => section.trace.resolved) ?? false);
	/** Bound-but-failing sections (errors, truncation); plain "unbound" is reported by the source line. */
	const sourceProblems = $derived(
		(globalReport?.sections ?? []).filter(
			(section) =>
				section.meta &&
				!["OK", "EMPTY", "SOURCE_UNBOUND"].includes(section.meta.state) &&
				// Recent is intentionally bounded (latest N events); truncation there is expected, not a source problem.
				!(section.id === "events" && section.meta.state === "TRUNCATED"),
		),
	);
	const globalSourceState = $derived(
		(
			globalReport?.sections.find((section) => section.id === "entities") ??
			globalReport?.sections.find((section) => section.meta && !["OK", "EMPTY"].includes(section.meta.state))
		)?.meta?.state ?? "SOURCE_UNBOUND",
	);

	const freshnessClass: Record<string, string> = {
		fresh: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
		aging: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
		stale: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
		unknown: "bg-[var(--hover-background)]",
	};

	function shortHead(head: string | undefined): string {
		return head ? head.slice(0, 10) : "";
	}

	function projectHref(projectId: string): string {
		return "/?project=" + encodeURIComponent(projectId);
	}

	let contextState = $state<{ context: PortfolioContext; format: "markdown" | "json" } | null>(null);
	const contextText = $derived(
		contextState
			? contextState.format === "json"
				? JSON.stringify(contextState.context, null, 2)
				: contextToMarkdown(contextState.context)
			: "",
	);

	function openContext(project: CockpitProject, purpose: ContextPurpose) {
		contextState = {
			context: buildProjectContext({
				project,
				work: [...cockpit.readyToTest, ...cockpit.blocked, ...globalWorkCards(project.id)],
				events: cockpit.recent,
				purpose,
				mongokuUrl: page.url.origin + projectHref(project.id),
				totalProjects: cockpit.projects.length,
			}),
			format: purpose === "developer_handoff" ? "json" : "markdown",
		};
	}

	/** Every open work item for one project, deduplicated against the ready/blocked lanes by id. */
	function globalWorkCards(projectId: string): WorkCard[] {
		return globalWork
			.filter((item) => text(item, "project_id") === projectId)
			.map((item) => ({
				id: text(item, "work_item_id") || text(item, "_id"),
				projectId,
				projectName: cockpitById.get(projectId)?.name ?? projectId,
				title: text(item, "title"),
				kind: text(item, "kind") || undefined,
				priority: text(item, "priority") || undefined,
				status: text(item, "status"),
				nextAction: text(item, "next_action") || undefined,
				observedAt: text(item, "observed_at") || undefined,
				source: "work_item" as const,
			}))
			.filter((card, index, all) => all.findIndex((other) => other.id === card.id) === index);
	}

	async function copyContext() {
		try {
			await navigator.clipboard.writeText(contextText);
			notificationStore.notifySuccess("Context copied (" + contextText.length + " characters)");
		} catch {
			notificationStore.notify("Clipboard unavailable; select the preview text and copy it manually.", "error");
		}
	}
</script>

{#snippet workList(cards: WorkCard[], empty: string)}
	<div class="divide-y divide-[var(--border-color)]">
		{#each cards as card (card.id)}
			<div class="px-4 py-2.5">
				<div class="flex items-center justify-between gap-2">
					<a
						href={resolve(projectHref(card.projectId))}
						class="truncate text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] no-underline hover:underline"
						>{card.projectName}</a
					>
					<span class="shrink-0 rounded-full bg-[var(--hover-background)] px-2 py-0.5 text-[9px]">
						{card.priority ? card.priority + " · " : ""}{card.status}
					</span>
				</div>
				<p class="mt-1 text-xs font-medium leading-4">{card.title}</p>
				{#if card.nextAction}
					<p class="mt-1 text-[10px] leading-4 text-[var(--text-muted)]">→ {card.nextAction}</p>
				{/if}
				{#if card.source === "entity_gate"}
					<p class="mt-1 text-[9px] text-[var(--text-muted)]">Entity test gate (no work item)</p>
				{/if}
			</div>
		{:else}
			<p class="p-4 text-xs text-[var(--text-muted)]">{empty}</p>
		{/each}
	</div>
{/snippet}

<section class="space-y-8">
	<div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
		<div>
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Global project cockpit</p>
			<h1 class="mt-2 text-3xl font-semibold tracking-tight">What to resume, test and unblock</h1>
			<p class="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">
				Read-only portfolio view over <code>DATAPASSCONTROL / dataprojects_control</code>. Domain authorities (FOIL PM,
				AtlasNote, …) stay the owners of their detail; Mongoku shows bounded projections and links.
			</p>
		</div>
		<div class="flex gap-2">
			<a
				href={resolve("/projects")}
				class="rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-medium no-underline hover:bg-[var(--hover-background)]"
				>Portfolio board</a
			>
			<a
				href={resolve("/foil")}
				class="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white no-underline dark:bg-white dark:text-black"
				>Open FOIL</a
			>
		</div>
	</div>

	<section class="rounded-xl border border-[var(--border-color)] p-4">
		<div class="flex flex-wrap items-center gap-2">
			<a href={resolve(organizationHref("all"))} class={organizationClass("all")}>All</a>
			{#each organizations as organization (text(organization, "organization_id"))}
				{@const organizationId = text(organization, "organization_id")}
				<a href={resolve(organizationHref(organizationId))} class={organizationClass(organizationId)}>
					{text(organization, "name")}
				</a>
			{/each}
			<a href={resolve(organizationHref("independent"))} class={organizationClass("independent")}>Independent</a>
			{#if focusProject}
				<a
					href={resolve("/")}
					class="rounded-full border border-dashed border-[var(--border-color)] px-3 py-1.5 text-xs no-underline"
					>Project: {cockpitById.get(focusProject)?.name ?? focusProject} ×</a
				>
			{/if}

			<div class="ml-auto flex flex-wrap gap-2">
				<select
					bind:value={selectedCategory}
					class="rounded-lg border border-[var(--border-color)] bg-transparent px-2 py-1.5 text-xs"
				>
					<option value="all">All categories</option>
					{#each categories as category (category)}
						<option value={category}>{category}</option>
					{/each}
				</select>
				<select
					bind:value={selectedReadiness}
					class="rounded-lg border border-[var(--border-color)] bg-transparent px-2 py-1.5 text-xs"
				>
					<option value="all">All readiness</option>
					{#each readinessValues as value (value)}
						<option {value}>{value}</option>
					{/each}
				</select>
			</div>
		</div>
		<p class="mt-3 text-[10px] text-[var(--text-muted)]" data-testid="global-source">
			Source:
			{#if sourceAvailable && globalTrace}
				<strong>live</strong> · {globalTrace.authority} · {globalTrace.database ?? "?"} · {entities.length} entities ·
				{globalWork.filter((item) => !isDoneStatus(text(item, "status"))).length} open work items · {organizations.length}
				organizations · read-only
			{:else if globalSourceState === "SOURCE_UNBOUND"}
				<strong>not bound</strong> — no live portfolio rows are shown
			{:else}
				<strong>unavailable ({globalSourceState})</strong> — no live portfolio rows are shown; nothing is substituted
			{/if}
		</p>
	</section>

	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
		<div class="rounded-xl border border-[var(--border-color)] p-5">
			<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Projects / entities</p>
			<p class="mt-2 text-3xl font-semibold">{visibleEntities.length}</p>
		</div>
		<div class="rounded-xl border border-[var(--border-color)] p-5">
			<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Open global work</p>
			<p class="mt-2 text-3xl font-semibold">{openGlobalWork.length}</p>
		</div>
		<div class="rounded-xl border border-[var(--border-color)] p-5">
			<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Blocked / waiting</p>
			<p class="mt-2 text-3xl font-semibold">{blocked.length}</p>
		</div>
		<div class="rounded-xl border border-[var(--border-color)] p-5">
			<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Ready to test</p>
			<p class="mt-2 text-3xl font-semibold">{readyToTest.length}</p>
		</div>
		<div class="rounded-xl border border-[var(--border-color)] p-5">
			<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">FOIL P0 attention</p>
			<p class="mt-2 text-3xl font-semibold">{foilSourceAvailable ? foilP0.length : "—"}</p>
			{#if !foilSourceAvailable}
				<p class="mt-1 text-[9px] text-[var(--text-muted)]">FOIL PM not bound</p>
			{/if}
		</div>
	</div>

	{#if !sourceAvailable && globalSourceState === "SOURCE_UNBOUND"}
		<div class="rounded-xl border border-dashed border-[var(--border-color)] p-5 text-sm text-[var(--text-muted)]">
			The global source is not bound in this runtime. Configure <code>DATAPASS_SOURCE_BINDINGS</code>; Mongoku will not
			create or infer a replacement database.
		</div>
	{/if}
	{#each sourceProblems as section (section.id)}
		<div class="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-800 dark:bg-amber-950">
			{section.label}: <strong>{section.meta?.state}</strong>
			{#if section.trace.message}— {section.trace.message}{/if}
		</div>
	{/each}

	<div class="grid gap-5 xl:grid-cols-3">
		<section class="rounded-xl border border-[var(--border-color)]" data-testid="today">
			<div class="border-b border-[var(--border-color)] px-4 py-3">
				<h2 class="text-sm font-semibold">Today</h2>
				<p class="mt-1 text-[10px] text-[var(--text-muted)]">P0 tests that are ready and P0 work that can move now.</p>
			</div>
			{@render workList(today, "Nothing P0 is actionable for this filter.")}
		</section>
		<section class="rounded-xl border border-[var(--border-color)]" data-testid="ready-to-test">
			<div class="border-b border-[var(--border-color)] px-4 py-3">
				<h2 class="text-sm font-semibold">Ready to test ({readyToTest.length})</h2>
				<p class="mt-1 text-[10px] text-[var(--text-muted)]">Test work items and entity READY_* gates.</p>
			</div>
			{@render workList(readyToTest, "No test gate is ready for this filter.")}
		</section>
		<section class="rounded-xl border border-[var(--border-color)]" data-testid="blocked">
			<div class="border-b border-[var(--border-color)] px-4 py-3">
				<h2 class="text-sm font-semibold">Blocked / waiting ({blocked.length})</h2>
				<p class="mt-1 text-[10px] text-[var(--text-muted)]">Raw source status is shown unchanged.</p>
			</div>
			{@render workList(blocked, "Nothing blocked for this filter.")}
		</section>
	</div>

	<section class="rounded-xl border border-[var(--border-color)]" data-testid="resume">
		<div class="border-b border-[var(--border-color)] px-4 py-3">
			<h2 class="text-sm font-semibold">Resume</h2>
			<p class="mt-1 text-[10px] text-[var(--text-muted)]">
				Most recently verified active projects: where you stopped and what comes next.
			</p>
		</div>
		<div class="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
			{#each resume as project (project.id)}
				<article class="rounded-lg border border-[var(--border-color)] p-3">
					<div class="flex items-center justify-between gap-2">
						<a href={resolve(projectHref(project.id))} class="text-sm font-semibold no-underline hover:underline"
							>{project.name}</a
						>
						<span class={"rounded-full px-2 py-0.5 text-[9px] " + freshnessClass[project.freshness]}
							>{project.freshness}</span
						>
					</div>
					{#if project.repo}
						<p class="mt-1 truncate text-[10px] text-[var(--text-muted)]">
							{project.repo}{project.branch ? " · " + project.branch : ""}{project.head
								? " @ " + shortHead(project.head)
								: ""}
						</p>
					{/if}
					{#if project.stopPoint}
						<p class="mt-2 text-[11px] leading-4"><span class="font-semibold">Stopped:</span> {project.stopPoint}</p>
					{/if}
					<p class="mt-2 text-[11px] leading-4"><span class="font-semibold">Next:</span> {project.nextAction}</p>
					<button
						type="button"
						class="mt-3 rounded-md border border-[var(--border-color)] px-2 py-1 text-[10px] hover:bg-[var(--hover-background)]"
						onclick={() => openContext(project, "ai_handoff")}>AI context</button
					>
				</article>
			{:else}
				<p class="text-xs text-[var(--text-muted)]">No active project with a next action for this filter.</p>
			{/each}
		</div>
	</section>

	<div class="grid gap-5 xl:grid-cols-3">
		<section class="rounded-xl border border-[var(--border-color)]" data-testid="websites">
			<div class="border-b border-[var(--border-color)] px-4 py-3">
				<h2 class="text-sm font-semibold">Websites</h2>
				<p class="mt-1 text-[10px] text-[var(--text-muted)]">
					Production URL only when recorded; unknown URLs stay unknown.
				</p>
			</div>
			<div class="divide-y divide-[var(--border-color)]">
				{#each websites as project (project.id)}
					<div class="px-4 py-3">
						<div class="flex items-center justify-between gap-2">
							<p class="text-xs font-semibold">{project.name}</p>
							<span class="rounded-full bg-[var(--hover-background)] px-2 py-0.5 text-[9px]">
								{project.runtime?.provider ?? "provider unknown"}
							</span>
						</div>
						{#if project.runtime?.url}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a href={project.runtime.url} target="_blank" rel="noreferrer noopener" class="mt-1 block text-[11px]"
								>{project.runtime.url}</a
							>
							<p class="text-[9px] text-[var(--text-muted)]">current production</p>
						{:else}
							<p class="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
								{project.runtime?.urlStatus}
							</p>
						{/if}
						{#if project.runtime?.fallbacks.length}
							<p class="mt-1 text-[9px] text-[var(--text-muted)]">
								Historical / fallback: {project.runtime.fallbacks.join(", ")}
							</p>
						{/if}
					</div>
				{:else}
					<p class="p-4 text-xs text-[var(--text-muted)]">No runtime surfaces recorded for this filter.</p>
				{/each}
			</div>
		</section>

		<section class="rounded-xl border border-[var(--border-color)]" data-testid="knowledge">
			<div class="border-b border-[var(--border-color)] px-4 py-3">
				<h2 class="text-sm font-semibold">Knowledge</h2>
				<p class="mt-1 text-[10px] text-[var(--text-muted)]">
					Metadata-only projections. Content stays with its owner; counts appear only after an overview export.
				</p>
			</div>
			<div class="divide-y divide-[var(--border-color)]">
				{#each knowledge as project (project.id)}
					{@const projection = project.knowledge}
					<div class="px-4 py-3 text-[11px]">
						<div class="flex items-center justify-between gap-2">
							<p class="text-xs font-semibold">{project.name}</p>
							<span class="rounded-full bg-[var(--hover-background)] px-2 py-0.5 text-[9px]">{projection?.mode}</span>
						</div>
						{#if projection?.counts}
							<div class="mt-2 grid grid-cols-3 gap-1">
								{#each Object.entries(projection.counts) as [key, value] (key)}
									<div class="rounded bg-[var(--hover-background)] p-1.5 text-center">
										<p class="text-sm font-semibold">{value}</p>
										<p class="text-[8px] text-[var(--text-muted)]">{key.replaceAll("_", " ")}</p>
									</div>
								{/each}
							</div>
							<p class="mt-1 text-[9px] text-[var(--text-muted)]">Snapshot {projection.lastSnapshotAt ?? "undated"}</p>
						{:else}
							<p class="mt-1 font-medium">{projection?.syncStatus ?? "No overview snapshot ingested"}</p>
							<p class="mt-1 text-[9px] text-[var(--text-muted)]">
								Awaiting: {projection?.desiredFields.join(", ") || "—"}
							</p>
						{/if}
						{#if projection?.prohibitedCopies.length}
							<p class="mt-1 text-[9px] text-[var(--text-muted)]">
								Never copied: {projection.prohibitedCopies.join(", ")}
							</p>
						{/if}
					</div>
				{:else}
					<p class="p-4 text-xs text-[var(--text-muted)]">No knowledge projection for this filter.</p>
				{/each}
			</div>
		</section>

		<section class="rounded-xl border border-[var(--border-color)]" data-testid="recent">
			<div class="border-b border-[var(--border-color)] px-4 py-3">
				<h2 class="text-sm font-semibold">Recent</h2>
				<p class="mt-1 text-[10px] text-[var(--text-muted)]">Latest portfolio events (bounded, newest first).</p>
			</div>
			<div class="divide-y divide-[var(--border-color)]">
				{#each recent as event (event.id)}
					<div class="px-4 py-2.5" class:opacity-60={event.superseded}>
						<div class="flex items-center justify-between gap-2 text-[9px] text-[var(--text-muted)]">
							<span>{event.projectId ?? "—"} · {event.type ?? "event"}</span>
							<span>{event.observedAt?.slice(0, 10)}</span>
						</div>
						<p class="mt-1 text-[11px] leading-4">{event.summary}</p>
						{#if event.superseded}<p class="text-[9px]">superseded</p>{/if}
					</div>
				{:else}
					<p class="p-4 text-xs text-[var(--text-muted)]">No recent events for this filter.</p>
				{/each}
			</div>
		</section>
	</div>

	{#if reconciliation.length > 0}
		<section
			class="rounded-xl border border-dashed border-amber-400 p-4 dark:border-amber-700"
			data-testid="reconciliation"
		>
			<h2 class="text-sm font-semibold">Data reconciliation to review ({reconciliation.length})</h2>
			<p class="mt-1 text-[10px] text-[var(--text-muted)]">
				Detected from source records. Mongoku does not rename, re-parent or rewrite them; resolve through a reviewed
				data batch.
			</p>
			<ul class="mt-3 space-y-2">
				{#each reconciliation as finding (finding.id)}
					<li class="text-[11px] leading-4">
						<span class="mr-1 rounded bg-[var(--hover-background)] px-1.5 py-0.5 text-[9px] uppercase"
							>{finding.severity}</span
						>
						<strong>{finding.title}</strong> — {finding.detail}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<div class="grid gap-5 xl:grid-cols-2" data-testid="project-cards">
		{#each visibleEntities as entity (entityId(entity))}
			{@const id = entityId(entity)}
			{@const project = cockpitById.get(id)}
			<article class="rounded-xl border border-[var(--border-color)] p-5" class:ring-2={focusProject === id}>
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0">
						<p class="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
							{project?.organizationId ?? "independent"} · {project?.category || project?.entityType || "node"}
						</p>
						<h2 class="mt-1 text-lg font-semibold">
							<a href={resolve(projectHref(id))} class="no-underline hover:underline">{project?.name ?? id}</a>
						</h2>
						<p class="mt-2 text-xs leading-5 text-[var(--text-muted)]">{project?.summary}</p>
					</div>
					<div class="flex shrink-0 flex-col items-end gap-1">
						<span class="rounded-full border border-[var(--border-color)] px-2.5 py-1 text-[10px]"
							>{project?.status}</span
						>
						{#if project}
							<span
								class={"rounded-full px-2 py-0.5 text-[9px] " + freshnessClass[project.freshness]}
								title="Freshness of last_verified_at / updated_at"
							>
								{project.freshness}
							</span>
						{/if}
					</div>
				</div>

				{#if project}
					<dl class="mt-4 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 text-[11px]">
						<dt class="text-[var(--text-muted)]">Repo</dt>
						<dd class="min-w-0 truncate">
							{#if project.repo}
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
								<a href={"https://github.com/" + project.repo} target="_blank" rel="noreferrer noopener"
									>{project.repo}</a
								>
							{:else}
								<span class="text-[var(--text-muted)]">not registered</span>
							{/if}
						</dd>
						<dt class="text-[var(--text-muted)]">Branch / head</dt>
						<dd class="min-w-0 truncate font-mono text-[10px]">
							{project.branch ?? "—"}{project.head ? " @ " + shortHead(project.head) : ""}
						</dd>
						<dt class="text-[var(--text-muted)]">Test gate</dt>
						<dd>{project.testReadiness ?? "—"}</dd>
						<dt class="text-[var(--text-muted)]">CI</dt>
						<dd>
							{#if project.ci}
								{project.ci.result ?? "?"}{project.ci.runs.length
									? " · runs " + project.ci.runs.join(", ")
									: ""}{project.ci.head && project.head && project.ci.head !== project.head ? " · CI head differs" : ""}
							{:else}
								<span class="text-[var(--text-muted)]">no CI evidence recorded</span>
							{/if}
							{#if project.pullRequest}
								· PR #{project.pullRequest.number}
								{project.pullRequest.state}{project.pullRequest.draft ? " (draft)" : ""}
							{/if}
						</dd>
						<dt class="text-[var(--text-muted)]">Runtime</dt>
						<dd class="min-w-0 truncate">
							{#if project.runtime}
								{project.runtime.provider ?? "provider unknown"} ·
								{#if project.runtime.url}
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
									<a href={project.runtime.url} target="_blank" rel="noreferrer noopener">{project.runtime.url}</a>
								{:else}
									{project.runtime.urlStatus}
								{/if}
							{:else}
								<span class="text-[var(--text-muted)]">none recorded</span>
							{/if}
						</dd>
						<dt class="text-[var(--text-muted)]">Health</dt>
						<dd>{project.health ?? "not classified"}</dd>
						<dt class="text-[var(--text-muted)]">Open work</dt>
						<dd>{project.openWork} open · {project.blockedWork} blocked</dd>
						{#if project.versions.current || project.versions.target}
							<dt class="text-[var(--text-muted)]">Version</dt>
							<dd>
								{#if project.versions.current}current {project.versions.current} ({project.versions.currentState}){/if}
								{#if project.versions.target}
									· target {project.versions.target} ({project.versions.targetState}){/if}
							</dd>
						{/if}
						<dt class="text-[var(--text-muted)]">Verified</dt>
						<dd>{project.lastVerifiedAt ?? project.updatedAt ?? "—"}</dd>
					</dl>

					{#if project.stopPoint}
						<div class="mt-4">
							<p class="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Stop point</p>
							<p class="mt-1 text-xs leading-5">{project.stopPoint}</p>
						</div>
					{/if}
					{#if project.nextAction}
						<div class="mt-3">
							<p class="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Next action</p>
							<p class="mt-1 text-xs leading-5">{project.nextAction}</p>
						</div>
					{/if}

					<div class="mt-4 flex flex-wrap gap-2 border-t border-[var(--border-color)] pt-3">
						<button
							type="button"
							class="rounded-md border border-[var(--border-color)] px-2 py-1 text-[10px] hover:bg-[var(--hover-background)]"
							onclick={() => openContext(project, "ai_handoff")}>AI context</button
						>
						<button
							type="button"
							class="rounded-md border border-[var(--border-color)] px-2 py-1 text-[10px] hover:bg-[var(--hover-background)]"
							title="Stable IDs and bounded state for DataPass VS Code; no secrets"
							onclick={() => openContext(project, "developer_handoff")}>Developer context</button
						>
						{#if project.organizationId === "foil" || id.startsWith("foil")}
							<a
								href={resolve("/foil")}
								class="rounded-md border border-[var(--border-color)] px-2 py-1 text-[10px] no-underline"
							>
								Open FOIL cockpit
							</a>
						{/if}
						<span class="ml-auto self-center text-[9px] text-[var(--text-muted)]">
							Authority: DATAPASSCONTROL · id <code>{id}</code>
						</span>
					</div>
				{/if}

				{#if id === "foil" || id === "foil_project"}
					<div class="mt-4 rounded-lg border border-[var(--border-color)] p-3">
						<p class="text-xs font-semibold">FOIL PM summary</p>
						{#if foilSourceAvailable}
							<p class="mt-2 text-[10px] text-[var(--text-muted)]">
								{foilScorecards.length} PM scorecards · {foilP0.length} P0 attention item(s)
							</p>
						{:else}
							<p class="mt-2 text-[10px] text-[var(--text-muted)]">FOIL PM source not bound in this runtime.</p>
						{/if}
					</div>
				{/if}
			</article>
		{:else}
			<div class="rounded-xl border border-dashed border-[var(--border-color)] p-6 text-sm text-[var(--text-muted)]">
				No global portfolio rows available. The local seed project list is intentionally not treated as a replacement
				authority.
			</div>
		{/each}
	</div>

	<section class="rounded-xl border border-[var(--border-color)]">
		<div class="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
			<div>
				<h2 class="text-sm font-semibold">Portfolio hierarchy</h2>
				<p class="mt-1 text-[10px] text-[var(--text-muted)]">
					Configurable typed navigation tree. Cross-links stay separate from parent/child navigation.
				</p>
			</div>
			<span class="text-[10px] text-[var(--text-muted)]">{visibleRelationships.length} visible relationship(s)</span>
		</div>
		<div class="divide-y divide-[var(--border-color)]">
			{#each visibleHierarchy as item (entityId(item.row))}
				<div class="flex items-center gap-3 px-4 py-2.5" style={"padding-left: " + (16 + item.depth * 22) + "px"}>
					<span class="w-2 shrink-0 text-[10px] text-[var(--text-muted)]">{item.depth > 0 ? "↳" : "•"}</span>
					<div class="min-w-0 flex-1">
						<p class="truncate text-xs font-medium">{text(item.row, "name") || entityId(item.row)}</p>
						<p class="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">
							{text(item.row, "entity_type") || text(item.row, "entity_level") || "node"}
							{#if text(item.row, "category")}
								· {text(item.row, "category")}{/if}
						</p>
					</div>
					<span class="rounded-full border border-[var(--border-color)] px-2 py-0.5 text-[9px]">
						{text(item.row, "status") || "unclassified"}
					</span>
				</div>
			{:else}
				<p class="p-4 text-xs text-[var(--text-muted)]">No hierarchy nodes for this filter.</p>
			{/each}
		</div>
		{#if visibleRelationships.length > 0}
			<div class="border-t border-[var(--border-color)] px-4 py-3">
				<p class="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Cross-links</p>
				<div class="mt-2 flex flex-wrap gap-2">
					{#each visibleRelationships.slice(0, 12) as relationship (text(relationship, "relationship_id") || text(relationship, "_id"))}
						<span class="rounded-full bg-[var(--hover-background)] px-2.5 py-1 text-[10px]">
							{text(relationship, "from_id")} → {text(relationship, "to_id")} · {text(relationship, "type")}
						</span>
					{/each}
				</div>
			</div>
		{/if}
	</section>

	<div class="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
		<section class="rounded-xl border border-[var(--border-color)]">
			<div class="border-b border-[var(--border-color)] px-4 py-3">
				<h2 class="text-sm font-semibold">Global work board</h2>
				<p class="mt-1 text-[10px] text-[var(--text-muted)]">
					Macro portfolio work only. Detailed project/domain backlogs remain external where authoritative.
				</p>
			</div>
			<div class="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
				{#each globalWorkColumns as column (column.id)}
					<section class="rounded-lg bg-[var(--hover-background)] p-3">
						<h3 class="text-xs font-semibold">{column.label}</h3>
						<div class="mt-3 space-y-2">
							{#each visibleGlobalWork.filter((item) => workBucket(item) === column.id) as item (text(item, "work_item_id") || text(item, "_id"))}
								<article class="rounded-md border border-[var(--border-color)] bg-[var(--background-color)] p-2">
									<div class="flex items-center justify-between gap-2">
										<span class="text-[9px] font-semibold uppercase">{text(item, "priority")}</span>
										<span class="text-[9px] text-[var(--text-muted)]">{text(item, "project_id")}</span>
									</div>
									<p class="mt-1 text-[11px] font-medium leading-4">{text(item, "title")}</p>
								</article>
							{:else}
								<p class="text-[10px] text-[var(--text-muted)]">None</p>
							{/each}
						</div>
					</section>
				{/each}
			</div>
		</section>

		<section class="rounded-xl border border-[var(--border-color)]">
			<div class="border-b border-[var(--border-color)] px-4 py-3">
				<h2 class="text-sm font-semibold">Calendar / reviews</h2>
				<p class="mt-1 text-[10px] text-[var(--text-muted)]">Only explicit due or review dates are shown.</p>
			</div>
			<div class="divide-y divide-[var(--border-color)]">
				{#each scheduledGlobalWork.slice(0, 8) as item (text(item, "work_item_id") || text(item, "_id"))}
					<div class="px-4 py-3">
						<div class="flex items-start justify-between gap-3">
							<p class="text-xs font-medium">{text(item, "title")}</p>
							<span class="shrink-0 text-[10px] text-[var(--text-muted)]">{scheduledAt(item)}</span>
						</div>
						<p class="mt-1 text-[10px] text-[var(--text-muted)]">{text(item, "project_id")}</p>
					</div>
				{:else}
					<p class="p-4 text-xs text-[var(--text-muted)]">No explicit global due/review dates for this filter.</p>
				{/each}
			</div>
		</section>
	</div>

	<div class="rounded-xl border border-[var(--border-color)] p-4 text-[10px] text-[var(--text-muted)]">
		Global Home does not fetch FOIL Core Truth, STUDY, AI Reasoning, FRONT, IT DEV or Work Archive. FOIL is summarized
		from Project Management only until you enter the FOIL cockpit.
	</div>
</section>

<Modal show={contextState !== null} onclose={() => (contextState = null)} title="Bounded context export" wide>
	{#if contextState}
		<p class="text-[11px] text-[var(--text-muted)]">
			{contextState.context.scope.organization_id}/{contextState.context.scope.project_id} ·
			{contextState.context.items.length} item(s) · {contextState.context.sources.length} source(s) · credentials scrubbed
			·
			{contextState.context.exclusions[0]}
		</p>
		<div class="mt-3 flex gap-2">
			<button
				type="button"
				class="rounded-md border border-[var(--border-color)] px-2 py-1 text-xs"
				class:font-semibold={contextState.format === "markdown"}
				onclick={() => contextState && (contextState.format = "markdown")}>Markdown</button
			>
			<button
				type="button"
				class="rounded-md border border-[var(--border-color)] px-2 py-1 text-xs"
				class:font-semibold={contextState.format === "json"}
				onclick={() => contextState && (contextState.format = "json")}>JSON</button
			>
			<button
				type="button"
				class="ml-auto rounded-md bg-black px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-black"
				onclick={copyContext}>Copy</button
			>
		</div>
		<pre
			class="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--hover-background)] p-3 text-[11px]"
			data-testid="context-preview">{contextText}</pre>
	{/if}
</Modal>
