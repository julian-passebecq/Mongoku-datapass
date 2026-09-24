<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import type { ReportResult } from "$lib/datapass/reporting";
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
	const audits = $derived(sectionRows(globalReport, "audits"));
	const repositories = $derived(sectionRows(globalReport, "repositories"));
	const foilScorecards = $derived(sectionRows(foilReport, "scorecards"));
	const foilP0 = $derived(sectionRows(foilReport, "p0"));

	function text(row: Record<string, unknown>, key: string): string {
		const value = row[key];
		return value == null ? "" : String(value);
	}

	function entityId(row: Record<string, unknown>): string {
		return text(row, "entity_id") || text(row, "id") || text(row, "_id");
	}

	function workFor(id: string) {
		return globalWork.filter((item) => text(item, "project_id") === id);
	}

	function repoFor(id: string) {
		return repositories.find((item) => text(item, "entity_id") === id && /canonical/i.test(text(item, "role")));
	}

	function latestAudit(id: string) {
		return audits.find((item) =>
			[text(item, "project_id"), text(item, "entity_id"), text(item, "project")].includes(id),
		);
	}

	function blockedCount(id: string): number {
		return workFor(id).filter((item) => /block|hold|wait/i.test(text(item, "status"))).length;
	}

	function nextAction(id: string, entity?: Record<string, unknown>): string {
		const entityAction = entity ? text(entity, "next_action") : "";
		if (entityAction) {
			return entityAction;
		}
		const item = workFor(id).find((candidate) => text(candidate, "next_action")) ?? workFor(id)[0];
		return item ? text(item, "next_action") || text(item, "title") : "";
	}

	let selectedCategory = $state(page.url.searchParams.get("category") || "all");
	let selectedReadiness = $state(page.url.searchParams.get("readiness") || "all");
	const selectedOrganization = $derived(page.url.searchParams.get("org") || "all");

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
	const visibleRelationships = $derived(
		relationships.filter(
			(relationship) =>
				visibleEntityIds.has(text(relationship, "from_id")) && visibleEntityIds.has(text(relationship, "to_id")),
		),
	);
	const visibleGlobalWork = $derived(
		globalWork.filter((item) => selectedOrganization === "all" || visibleEntityIds.has(text(item, "project_id"))),
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

	const testQueue = $derived(
		globalWork.filter(
			(item) =>
				text(item, "kind") === "test" && ["ready", "verify", "blocked"].includes(text(item, "status").toLowerCase()),
		),
	);
	const visibleTestQueue = $derived(
		testQueue.filter((item) => selectedOrganization === "all" || visibleEntityIds.has(text(item, "project_id"))),
	);
	const readyToTest = $derived(visibleTestQueue.filter((item) => text(item, "status").toLowerCase() === "ready"));

	const sourceAvailable = $derived(globalReport?.sections.some((section) => section.trace.resolved) ?? false);
	const foilSourceAvailable = $derived(foilReport?.sections.some((section) => section.trace.resolved) ?? false);
</script>

<section class="space-y-8">
	<div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
		<div>
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Global project cockpit</p>
			<h1 class="mt-2 text-3xl font-semibold tracking-tight">Projects, attention and next actions</h1>
			<p class="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">
				Global portfolio data comes from <code>DATAPASSCONTROL / dataprojects_control</code>. FOIL contributes only its
				Project Management scorecard at this level; deep FOIL authorities are queried after opening FOIL.
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
	</section>

	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
		<div class="rounded-xl border border-[var(--border-color)] p-5">
			<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Projects / entities</p>
			<p class="mt-2 text-3xl font-semibold">{visibleEntities.length}</p>
		</div>
		<div class="rounded-xl border border-[var(--border-color)] p-5">
			<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Important global work</p>
			<p class="mt-2 text-3xl font-semibold">{globalWork.length}</p>
		</div>
		<div class="rounded-xl border border-[var(--border-color)] p-5">
			<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Blocked / waiting</p>
			<p class="mt-2 text-3xl font-semibold">
				{globalWork.filter((item) => /block|hold|wait/i.test(text(item, "status"))).length}
			</p>
		</div>
		<div class="rounded-xl border border-[var(--border-color)] p-5">
			<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Ready to test</p>
			<p class="mt-2 text-3xl font-semibold">{readyToTest.length}</p>
		</div>
		<div class="rounded-xl border border-[var(--border-color)] p-5">
			<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">FOIL P0 attention</p>
			<p class="mt-2 text-3xl font-semibold">{foilP0.length}</p>
		</div>
	</div>

	{#if !sourceAvailable}
		<div class="rounded-xl border border-dashed border-[var(--border-color)] p-5 text-sm text-[var(--text-muted)]">
			The global source is not bound in this runtime. Configure <code>DATAPASS_SOURCE_BINDINGS</code>; Mongoku will not
			create or infer a replacement database.
		</div>
	{/if}

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

	{#if visibleTestQueue.length > 0}
		<section class="rounded-xl border border-[var(--border-color)]">
			<div class="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
				<div>
					<h2 class="text-sm font-semibold">Test / verification queue</h2>
					<p class="mt-1 text-[10px] text-[var(--text-muted)]">
						Global portfolio gates only; detailed domain backlogs stay authoritative in their own systems.
					</p>
				</div>
				<span class="rounded-full bg-[var(--hover-background)] px-2 py-1 text-[10px]">
					{visibleTestQueue.length} gates
				</span>
			</div>
			<div class="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
				{#each visibleTestQueue as item (text(item, "work_item_id") || text(item, "_id"))}
					<article class="rounded-lg border border-[var(--border-color)] p-3">
						<div class="flex items-center justify-between gap-2">
							<span class="text-[10px] font-semibold uppercase tracking-wide">{text(item, "priority")}</span>
							<span class="rounded-full bg-[var(--hover-background)] px-2 py-0.5 text-[10px]">
								{text(item, "status")}
							</span>
						</div>
						<h3 class="mt-2 text-sm font-medium">{text(item, "title")}</h3>
						<p class="mt-1 text-[10px] text-[var(--text-muted)]">{text(item, "project_id")}</p>
						{#if text(item, "next_action")}
							<p class="mt-3 text-xs leading-5">{text(item, "next_action")}</p>
						{/if}
					</article>
				{/each}
			</div>
		</section>
	{/if}

	<div class="grid gap-5 xl:grid-cols-2">
		{#each visibleEntities as entity, __eachIndex0 (__eachIndex0)}
			{@const id = entityId(entity)}
			{@const canonicalRepo = text(entity, "canonical_repo") || text(repoFor(id) ?? {}, "repo")}
			{@const projectWork = workFor(id)}
			<article class="rounded-xl border border-[var(--border-color)] p-5">
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
							{text(entity, "category") || text(entity, "entity_type")}
						</p>
						<h2 class="mt-1 text-lg font-semibold">{text(entity, "name") || id}</h2>
						<p class="mt-2 text-xs leading-5 text-[var(--text-muted)]">{text(entity, "summary")}</p>
					</div>
					<span class="rounded-full border border-[var(--border-color)] px-2.5 py-1 text-[10px]"
						>{text(entity, "status")}</span
					>
				</div>

				<div class="mt-4 grid grid-cols-3 gap-2 text-center">
					<div class="rounded-lg bg-[var(--hover-background)] p-2">
						<p class="text-lg font-semibold">{projectWork.length}</p>
						<p class="text-[9px] text-[var(--text-muted)]">open global work</p>
					</div>
					<div class="rounded-lg bg-[var(--hover-background)] p-2">
						<p class="text-lg font-semibold">{blockedCount(id)}</p>
						<p class="text-[9px] text-[var(--text-muted)]">blocked / wait</p>
					</div>
					<div class="rounded-lg bg-[var(--hover-background)] p-2">
						<p class="text-[11px] font-semibold">{text(entity, "updated_at") || "—"}</p>
						<p class="text-[9px] text-[var(--text-muted)]">last update</p>
					</div>
				</div>

				{#if nextAction(id, entity)}
					<div class="mt-4">
						<p class="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Next action</p>
						<p class="mt-1 text-xs leading-5">{nextAction(id, entity)}</p>
					</div>
				{/if}

				{#if text(entity, "current_product_version") || text(entity, "target_design_version") || text(entity, "architecture_version")}
					<div class="mt-4 rounded-lg border border-[var(--border-color)] p-3 text-[10px]">
						<p class="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Version / architecture</p>
						{#if text(entity, "current_product_version")}
							<p class="mt-1">Current product: {text(entity, "current_product_version")} · {text(entity, "current_product_state")}</p>
						{/if}
						{#if text(entity, "target_design_version")}
							<p class="mt-1">Target design: {text(entity, "target_design_version")} · {text(entity, "target_design_state")}</p>
						{/if}
						{#if text(entity, "architecture_version")}
							<p class="mt-1">Architecture: {text(entity, "architecture_version")} · {text(entity, "status")}</p>
						{/if}
					</div>
				{/if}

				<div class="mt-4 grid grid-cols-2 gap-2 text-[10px]">
					<div class="rounded-lg bg-[var(--hover-background)] p-2">
						<p class="text-[9px] uppercase text-[var(--text-muted)]">Health</p>
						<p class="mt-1 font-medium">{text(entity, "health") || "not classified"}</p>
					</div>
					<div class="rounded-lg bg-[var(--hover-background)] p-2">
						<p class="text-[9px] uppercase text-[var(--text-muted)]">Verified</p>
						<p class="mt-1 font-medium">{text(entity, "last_verified_at") || text(entity, "updated_at") || "—"}</p>
					</div>
				</div>

				<div class="mt-4 border-t border-[var(--border-color)] pt-3 text-[10px] text-[var(--text-muted)]">
					<p>Canonical repo: {canonicalRepo || "not registered"}</p>
					{#if latestAudit(id)}
						<p class="mt-1">
							Last audit: {text(latestAudit(id) ?? {}, "observed_at") ||
								text(latestAudit(id) ?? {}, "created_at") ||
								text(latestAudit(id) ?? {}, "status")}
						</p>
					{/if}
					<p class="mt-1">Authority: DATAPASSCONTROL / dataprojects_control</p>
				</div>

				{#if id === "foil"}
					<div class="mt-4 rounded-lg border border-[var(--border-color)] p-3">
						<div class="flex items-center justify-between">
							<p class="text-xs font-semibold">FOIL PM summary</p>
							<a href={resolve("/foil")} class="text-[10px] no-underline hover:underline">Open FOIL cockpit</a>
						</div>
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

	<div class="rounded-xl border border-[var(--border-color)] p-4 text-[10px] text-[var(--text-muted)]">
		Global Home does not fetch FOIL Core Truth, STUDY, AI Reasoning, FRONT, IT DEV or Work Archive. FOIL is summarized
		from Project Management only until you enter the FOIL cockpit.
	</div>
</section>
