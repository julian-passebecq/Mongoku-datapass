<script lang="ts">
	import { resolve } from "$app/paths";
	import type { ReportResult } from "$lib/datapass/reporting";

	let { data } = $props();
	const reports = $derived(data.reports as ReportResult[]);
	const globalReport = $derived(reports.find((item) => item.reportId === "GLOBAL_PROJECTS"));
	const foilReport = $derived(reports.find((item) => item.reportId === "FOIL_STATUS_NOW"));

	const sectionRows = (report: ReportResult | undefined, id: string) =>
		report?.sections.find((section) => section.id === id)?.rows ?? [];

	const entities = $derived(sectionRows(globalReport, "entities"));
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

	function nextAction(id: string): string {
		const item = workFor(id).find((candidate) => text(candidate, "next_action")) ?? workFor(id)[0];
		return item ? text(item, "next_action") || text(item, "title") : "";
	}

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

	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
		<div class="rounded-xl border border-[var(--border-color)] p-5">
			<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Projects / entities</p>
			<p class="mt-2 text-3xl font-semibold">{entities.length}</p>
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

	<div class="grid gap-5 xl:grid-cols-2">
		{#each entities as entity}
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

				{#if nextAction(id)}
					<div class="mt-4">
						<p class="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Next action</p>
						<p class="mt-1 text-xs leading-5">{nextAction(id)}</p>
					</div>
				{/if}

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
