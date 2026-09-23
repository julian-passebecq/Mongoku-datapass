<script lang="ts">
	import type { ReportResult } from "$lib/datapass/reporting";

	let { data } = $props();
	const reports = $derived(data.reports as ReportResult[]);
	let mode = $state<"projects" | "authority" | "resources" | "runtime" | "propagation">("authority");

	const getReport = (id: string) => reports.find((item) => item.reportId === id);
	const architecture = $derived(getReport("FOIL_ARCHITECTURE_MAP"));
	const portfolio = $derived(getReport("FOIL_PROJECTS"));
	const propagation = $derived(getReport("FOIL_PROPAGATION_PENDING"));
	const routingRows = $derived(architecture?.sections.find((section) => section.id === "routing")?.rows ?? []);
	const resourceRows = $derived(architecture?.sections.find((section) => section.id === "resources")?.rows ?? []);
	const projectRows = $derived(portfolio?.sections.flatMap((section) => section.rows) ?? []);
	const propagationRows = $derived(propagation?.sections.flatMap((section) => section.rows) ?? []);

	const modes = [
		{ id: "projects", label: "Project hierarchy" },
		{ id: "authority", label: "Authority routing" },
		{ id: "resources", label: "Resource topology" },
		{ id: "runtime", label: "Software / runtime" },
		{ id: "propagation", label: "Propagation flow" }
	] as const;

	function text(row: Record<string, unknown>, key: string): string {
		const value = row[key];
		return value == null ? "" : String(value);
	}

	function list(row: Record<string, unknown>, key: string): string[] {
		const value = row[key];
		return Array.isArray(value) ? value.map(String) : [];
	}

	const resourcesById = $derived(new Map(resourceRows.map((row) => [text(row, "_id"), row])));
	const resourceChildren = (parentId: string) =>
		resourceRows.filter((row) => text(row, "parentResourceId") === parentId);

	const projectRoots = $derived(
		projectRows.filter((row) => {
			const related = list(row, "relatedProjects");
			return related.length === 0 || !related.some((id) => projectRows.some((candidate) => text(candidate, "_id") === id));
		})
	);

	const atlasProjects = $derived(resourceRows.filter((row) => text(row, "kind") === "ATLAS_PROJECT"));
	const repositories = $derived(resourceRows.filter((row) => text(row, "kind") === "GITHUB_REPOSITORY"));

	function routePairs(row: Record<string, unknown>): Array<{ question: string; target: string }> {
		const routes = row.routes;
		if (Array.isArray(routes)) {
			return routes
				.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
				.map((item) => ({ question: text(item, "question"), target: text(item, "target") }));
		}
		if (routes && typeof routes === "object") {
			return Object.entries(routes as Record<string, unknown>).map(([question, target]) => ({
				question,
				target: String(target)
			}));
		}
		return [];
	}

	function impactTargets(row: Record<string, unknown>): string[] {
		const value = row.impactTargets;
		if (!Array.isArray(value)) return [];
		return value.map((target) => {
			if (typeof target === "string") return target;
			if (target && typeof target === "object") {
				const record = target as Record<string, unknown>;
				return String(record.name ?? record.target ?? record.id ?? "target") + " · " + String(record.status ?? record.state ?? "DIRTY");
			}
			return String(target);
		});
	}
</script>

<section class="space-y-6">
	<div>
		<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">FOIL architecture</p>
		<h1 class="mt-2 text-3xl font-semibold tracking-tight">Separate relationship models</h1>
		<p class="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">
			Project hierarchy, authority routing, physical resources, software/runtime and propagation are deliberately separate views. They are related, but they are not equivalent graphs.
		</p>
	</div>

	<div class="flex flex-wrap gap-1 rounded-xl border border-[var(--border-color)] p-1">
		{#each modes as option}
			<button
				type="button"
				onclick={() => (mode = option.id)}
				class={"rounded-lg px-3 py-2 text-xs font-medium " + (mode === option.id ? "bg-[var(--hover-background)]" : "")}
			>{option.label}</button>
		{/each}
	</div>

	{#if mode === "projects"}
		<div class="space-y-5">
			<div class="rounded-xl border border-[var(--border-color)] p-4 text-xs text-[var(--text-muted)]">
				Source: FOIL Project Management portfolio. This view describes FOIL portfolios/apps/studies, not Mongo topology.
			</div>
			<div class="grid gap-4 xl:grid-cols-3">
				{#each projectRows as row}
					<article class="rounded-xl border border-[var(--border-color)] p-4">
						<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{text(row, "category") || text(row, "technology")}</p>
						<h2 class="mt-1 text-sm font-semibold">{text(row, "name") || text(row, "_id")}</h2>
						<p class="mt-2 text-xs text-[var(--text-muted)]">{text(row, "currentObjective")}</p>
						<div class="mt-3 flex flex-wrap gap-1">
							<span class="rounded-full bg-[var(--hover-background)] px-2 py-0.5 text-[10px]">{text(row, "status")}</span>
							<span class="rounded-full bg-[var(--hover-background)] px-2 py-0.5 text-[10px]">{text(row, "priority")}</span>
						</div>
						{#if list(row, "relatedProjects").length > 0}
							<p class="mt-3 text-[10px] text-[var(--text-muted)]">Related: {list(row, "relatedProjects").join(", ")}</p>
						{/if}
					</article>
				{:else}
					<div class="rounded-xl border border-dashed border-[var(--border-color)] p-6 text-sm text-[var(--text-muted)]">Project hierarchy source unavailable.</div>
				{/each}
			</div>
		</div>
	{:else if mode === "authority"}
		<div class="space-y-4">
			<div class="rounded-xl border border-[var(--border-color)] p-5">
				<div class="flex flex-wrap items-center justify-center gap-3 text-xs">
					<span class="rounded-lg border border-[var(--border-color)] px-4 py-3 font-semibold">Project Management · router / backlog</span>
					<span>→</span>
					{#each ["Core Truth", "STUDY", "AI Reasoning", "IT DEV", "FRONT", "Labs", "Work Archive", "GitHub"] as authority}
						<span class="rounded-lg bg-[var(--hover-background)] px-3 py-2">{authority}</span>
					{/each}
				</div>
			</div>
			{#each routingRows as row}
				<article class="rounded-xl border border-[var(--border-color)] p-5">
					<div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
						<div>
							<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{text(row, "scope")}</p>
							<h2 class="mt-1 text-sm font-semibold">{text(row, "name") || text(row, "_id")}</h2>
							<p class="mt-2 text-xs leading-5 text-[var(--text-muted)]">{text(row, "purpose") || text(row, "routingRule") || text(row, "authorityRule")}</p>
						</div>
						<span class="rounded-full border border-[var(--border-color)] px-2 py-0.5 text-[10px]">{text(row, "status")}</span>
					</div>
					{#if routePairs(row).length > 0}
						<div class="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
							{#each routePairs(row) as route}
								<div class="rounded-lg bg-[var(--hover-background)] p-3">
									<p class="text-[9px] uppercase text-[var(--text-muted)]">{route.question}</p>
									<p class="mt-1 text-[11px] font-medium">{route.target}</p>
								</div>
							{/each}
						</div>
					{/if}
				</article>
			{/each}
		</div>
	{:else if mode === "resources"}
		<div class="space-y-6">
			{#each atlasProjects as project}
				<section class="rounded-xl border border-[var(--border-color)] p-5">
					<div>
						<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Atlas project</p>
						<h2 class="mt-1 text-base font-semibold">{text(project, "recommendedDisplayName") || text(project, "name")}</h2>
						<p class="mt-1 text-[10px] text-[var(--text-muted)]">{text(project, "_id")} · {text(project, "externalId")}</p>
					</div>
					<div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
						{#each resourceChildren(text(project, "_id")) as cluster}
							<div class="rounded-lg bg-[var(--hover-background)] p-3">
								<p class="text-[9px] uppercase text-[var(--text-muted)]">{text(cluster, "kind")}</p>
								<p class="mt-1 text-xs font-semibold">{text(cluster, "name")}</p>
								{#each resourceChildren(text(cluster, "_id")) as database}
									<div class="mt-2 rounded border border-[var(--border-color)] p-2">
										<p class="text-[9px] uppercase text-[var(--text-muted)]">{text(database, "kind")}</p>
										<p class="mt-1 text-[10px] font-medium">{text(database, "name")}</p>
									</div>
								{/each}
							</div>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{:else if mode === "runtime"}
		<div class="grid gap-4 xl:grid-cols-2">
			<section class="rounded-xl border border-[var(--border-color)] p-5">
				<h2 class="text-sm font-semibold">Repositories</h2>
				<p class="mt-1 text-[10px] text-[var(--text-muted)]">Repository → branch / implementation role. GitHub remains code authority.</p>
				<div class="mt-4 space-y-2">
					{#each repositories as repo}
						<div class="rounded-lg bg-[var(--hover-background)] p-3">
							<p class="text-xs font-semibold">{text(repo, "name")}</p>
							<p class="mt-1 text-[10px] text-[var(--text-muted)]">{text(repo, "role")}</p>
							<p class="mt-1 text-[9px] text-[var(--text-muted)]">{text(repo, "defaultBranch")} · {text(repo, "currentHead") || text(repo, "verifiedHeadCommit")}</p>
						</div>
					{:else}
						<p class="text-xs text-[var(--text-muted)]">No repository resources returned.</p>
					{/each}
				</div>
			</section>
			<section class="rounded-xl border border-[var(--border-color)] p-5">
				<h2 class="text-sm font-semibold">Runtime/deployment state</h2>
				<p class="mt-1 text-[10px] text-[var(--text-muted)]">Runtime fields remain provider/runtime evidence, not repository state.</p>
				<div class="mt-4 space-y-2">
					{#each projectRows.filter((row) => row.deployment || row.runtime || row.productionDeployment || row.currentPreview) as row}
						<div class="rounded-lg bg-[var(--hover-background)] p-3">
							<p class="text-xs font-semibold">{text(row, "name") || text(row, "_id")}</p>
							<pre class="mt-2 max-h-40 overflow-auto text-[9px] leading-4">{JSON.stringify(row.deployment ?? row.runtime ?? row.currentPreview ?? row.productionDeployment, null, 2)}</pre>
						</div>
					{:else}
						<p class="text-xs text-[var(--text-muted)]">No runtime summaries returned by PM portfolio.</p>
					{/each}
				</div>
			</section>
		</div>
	{:else}
		<div class="space-y-4">
			<div class="rounded-xl border border-[var(--border-color)] p-5 text-xs text-[var(--text-muted)]">
				New source → primary authority → impact analysis → dependent targets DIRTY → reviewed propagation → verification. No source is synchronized merely because this view is opened.
			</div>
			{#each propagationRows as row}
				<article class="rounded-xl border border-[var(--border-color)] p-5">
					<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
						<div>
							<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{text(row, "propagationPriority")}</p>
							<h2 class="mt-1 text-sm font-semibold">{text(row, "title") || text(row, "_id")}</h2>
						</div>
						<span class="rounded-full border border-[var(--border-color)] px-2 py-0.5 text-[10px]">{text(row, "propagationStatus")}</span>
					</div>
					<div class="mt-4 flex flex-wrap gap-2">
						{#each impactTargets(row) as target}
							<span class="rounded-lg bg-[var(--hover-background)] px-3 py-2 text-[10px]">{target}</span>
						{/each}
					</div>
				</article>
			{:else}
				<div class="rounded-xl border border-dashed border-[var(--border-color)] p-6 text-sm text-[var(--text-muted)]">
					Propagation source is not configured yet. This architecture view does not create it.
				</div>
			{/each}
		</div>
	{/if}
</section>
