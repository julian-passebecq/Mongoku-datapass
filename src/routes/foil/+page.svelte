<script lang="ts">
	import type { ReportResult } from "$lib/datapass/reporting";

	let { data } = $props();
	const reports = $derived(data.reports as ReportResult[]);

	const report = (id: string) => reports.find((item) => item.reportId === id);
	const rows = (id: string, sectionId?: string) =>
		report(id)
			?.sections.filter((section) => !sectionId || section.id === sectionId)
			.flatMap((section) => section.rows) ?? [];

	const nextRows = $derived(rows("FOIL_NEXT"));
	const scorecards = $derived(rows("FOIL_STATUS_NOW", "scorecards"));
	const p0 = $derived(rows("FOIL_STATUS_NOW", "p0"));
	const recent = $derived(rows("FOIL_RECENT").slice(0, 12));
	const propagation = $derived(rows("FOIL_PROPAGATION_PENDING", "pending"));
	const propagationUnassessed = $derived(rows("FOIL_PROPAGATION_PENDING", "unassessed"));
	const maintenance = $derived(rows("FOIL_MAINTENANCE_DUE"));
	const drift = $derived(rows("FOIL_INSTRUCTION_DRIFT"));

	function text(row: Record<string, unknown>, key: string): string {
		const value = row[key];
		return value == null ? "" : String(value);
	}

	function bucket(row: Record<string, unknown>): string {
		const normalized = text(row, "displayStatus");
		if (normalized) {
			return normalized;
		}
		const status = text(row, "status").toUpperCase();
		if (/DONE|CLOSED|RESOLVED|COMPLETE/.test(status)) {
			return "DONE";
		}
		if (/BLOCK/.test(status)) {
			return "BLOCKED";
		}
		if (/WAIT|USER|BUSINESS|EXTERNAL/.test(status)) {
			return "WAITING_EXTERNAL";
		}
		if (/VERIFY|REVIEW|QUALIFIED|PRETEST/.test(status)) {
			return "VERIFY";
		}
		return "ACTIONABLE";
	}

	function horizon(row: Record<string, unknown>): string {
		const priority = text(row, "priority").toUpperCase();
		if (priority.startsWith("P0")) {
			return "NOW";
		}
		if (priority.startsWith("P1")) {
			return "NEXT";
		}
		return "LATER";
	}

	const actionable = $derived(nextRows.filter((row) => bucket(row) === "ACTIONABLE"));
	const blocked = $derived(nextRows.filter((row) => bucket(row) === "BLOCKED"));
	const waiting = $derived(nextRows.filter((row) => bucket(row) === "WAITING_EXTERNAL"));
	const verify = $derived(nextRows.filter((row) => bucket(row) === "VERIFY"));

	const quickActions = [
		{ label: "Status", href: "/foil/report/FOIL_STATUS_NOW" },
		{ label: "Next", href: "/foil/kanban" },
		{ label: "Recent", href: "/foil/report/FOIL_RECENT" },
		{ label: "Impact", href: "/foil/propagation" },
		{ label: "Pending propagation", href: "/foil/report/FOIL_PROPAGATION_PENDING" },
		{ label: "Questions Francis", href: "/foil/questions" },
		{ label: "Maintenance", href: "/foil/calendar" },
		{ label: "Apps", href: "/foil/report/FOIL_APPS_IMPACTED" },
		{ label: "P0 blockers", href: "/foil/report/FOIL_P0_BLOCKERS" },
		{ label: "Contradictions", href: "/foil/report/FOIL_CONTRADICTIONS" },
		{ label: "Architecture", href: "/foil/architecture" },
		{ label: "Documents", href: "/foil/documents" },
		{ label: "Resources", href: "/foil/resources" },
		{ label: "Audit status", href: "/foil/report/FOIL_MAINTENANCE_DUE" },
	];
</script>

<section class="space-y-6">
	<div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
		<div>
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">FOIL control cockpit</p>
			<h1 class="mt-2 text-3xl font-semibold tracking-tight">What needs attention now?</h1>
			<p class="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">
				Read-only control surface over FOIL authorities. Project Management routes work; Core Truth, STUDY, AI
				Reasoning, IT DEV, FRONT, Work Archive and runtime systems remain authoritative for their domains.
			</p>
		</div>
		<a
			href={resolve("/foil/resources")}
			class="rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-medium no-underline hover:bg-[var(--hover-background)]"
		>
			Authority & resource map
		</a>
	</div>

	<div class="flex flex-wrap gap-2">
		{#each quickActions as action, __eachIndex0 (__eachIndex0)}
			<a
				href={resolve(action.href)}
				class="rounded-full border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium no-underline hover:bg-[var(--hover-background)]"
				>{action.label}</a
			>
		{/each}
	</div>

	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
		<div class="rounded-xl border border-[var(--border-color)] p-4">
			<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">P0 / NOW</p>
			<p class="mt-2 text-2xl font-semibold">{p0.length}</p>
		</div>
		<div class="rounded-xl border border-[var(--border-color)] p-4">
			<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Actionable</p>
			<p class="mt-2 text-2xl font-semibold">{actionable.length}</p>
		</div>
		<div class="rounded-xl border border-[var(--border-color)] p-4">
			<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Blocked</p>
			<p class="mt-2 text-2xl font-semibold">{blocked.length}</p>
		</div>
		<div class="rounded-xl border border-[var(--border-color)] p-4">
			<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Waiting external</p>
			<p class="mt-2 text-2xl font-semibold">{waiting.length}</p>
		</div>
		<div class="rounded-xl border border-[var(--border-color)] p-4">
			<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Verify</p>
			<p class="mt-2 text-2xl font-semibold">{verify.length}</p>
		</div>
	</div>

	<div class="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
		<section class="rounded-xl border border-[var(--border-color)]">
			<div class="flex items-center justify-between border-b border-[var(--border-color)] px-5 py-4">
				<div>
					<h2 class="font-semibold">NOW · NEXT · LATER</h2>
					<p class="text-xs text-[var(--text-muted)]">Directly from FOIL Project Management backlog.</p>
				</div>
				<a href={resolve("/foil/kanban")} class="text-xs no-underline hover:underline">Open Kanban</a>
			</div>
			<div class="divide-y divide-[var(--border-color)]">
				{#each nextRows.slice(0, 14) as item, __eachIndex1 (__eachIndex1)}
					<div class="grid gap-2 px-5 py-3 md:grid-cols-[72px_120px_1fr]">
						<span class="text-[10px] font-semibold">{horizon(item)}</span>
						<span class="text-[10px] text-[var(--text-muted)]">{bucket(item)}</span>
						<div>
							<p class="text-sm font-medium">{text(item, "title") || text(item, "_id")}</p>
							<p class="mt-1 text-[11px] text-[var(--text-muted)]">
								{text(item, "nextAction") || text(item, "currentStep")}
							</p>
							<p class="mt-1 text-[10px] text-[var(--text-muted)]">
								Authority: FOIL Project Management · Ref: {text(item, "_id")}
							</p>
						</div>
					</div>
				{:else}
					<p class="p-5 text-sm text-[var(--text-muted)]">
						FOIL PM source is not bound in this runtime or returned no open backlog.
					</p>
				{/each}
			</div>
		</section>

		<section class="space-y-4">
			<div class="rounded-xl border border-[var(--border-color)] p-5">
				<h2 class="font-semibold">Pending propagation</h2>
				<p class="mt-1 text-xs text-[var(--text-muted)]">
					Dirty dependent products are tracked; opening this page performs no synchronization.
				</p>
				<p class="mt-4 text-3xl font-semibold">{propagation.length}</p>
				{#if propagationUnassessed.length > 0}
					<p class="mt-1 text-[10px] text-[var(--text-muted)]">
						{propagationUnassessed.length} event(s) have unassessed/legacy propagation metadata.
					</p>
				{/if}
				<a href={resolve("/foil/propagation")} class="mt-3 inline-block text-xs no-underline hover:underline"
					>Open propagation queue</a
				>
			</div>
			<div class="rounded-xl border border-[var(--border-color)] p-5">
				<h2 class="font-semibold">Maintenance due</h2>
				<p class="mt-1 text-xs text-[var(--text-muted)]">
					Reviews/audits/backups/checks only. No audit is executed automatically.
				</p>
				<p class="mt-4 text-3xl font-semibold">{maintenance.length}</p>
				<a href={resolve("/foil/calendar")} class="mt-3 inline-block text-xs no-underline hover:underline"
					>Open calendar</a
				>
			</div>
			<div class="rounded-xl border border-[var(--border-color)] p-5">
				<h2 class="font-semibold">Instruction drift</h2>
				<p class="mt-4 text-3xl font-semibold">{drift.length}</p>
				<a
					href={resolve("/foil/report/FOIL_INSTRUCTION_DRIFT")}
					class="mt-3 inline-block text-xs no-underline hover:underline">Inspect versions</a
				>
			</div>
		</section>
	</div>

	<div class="grid gap-6 xl:grid-cols-2">
		<section class="rounded-xl border border-[var(--border-color)]">
			<div class="border-b border-[var(--border-color)] px-5 py-4">
				<h2 class="font-semibold">PM scorecards</h2>
				<p class="text-xs text-[var(--text-muted)]">Global FOIL status without deep-fetching every domain authority.</p>
			</div>
			<div class="divide-y divide-[var(--border-color)]">
				{#each scorecards.slice(0, 12) as item, __eachIndex2 (__eachIndex2)}
					<div class="px-5 py-3">
						<div class="flex items-start justify-between gap-3">
							<div>
								<p class="text-sm font-medium">{text(item, "name") || text(item, "_id")}</p>
								<p class="mt-1 text-[11px] text-[var(--text-muted)]">{text(item, "nextAction")}</p>
							</div>
							<span class="text-[10px] text-[var(--text-muted)]">{text(item, "status")}</span>
						</div>
					</div>
				{:else}
					<p class="p-5 text-sm text-[var(--text-muted)]">No PM scorecards available.</p>
				{/each}
			</div>
		</section>

		<section class="rounded-xl border border-[var(--border-color)]">
			<div class="border-b border-[var(--border-color)] px-5 py-4">
				<h2 class="font-semibold">Recent authoritative changes</h2>
				<p class="text-xs text-[var(--text-muted)]">PM events + Work Archive provenance where configured.</p>
			</div>
			<div class="divide-y divide-[var(--border-color)]">
				{#each recent as item, __eachIndex3 (__eachIndex3)}
					<div class="px-5 py-3">
						<p class="text-sm font-medium">{text(item, "title") || text(item, "summary") || text(item, "eventType")}</p>
						<p class="mt-1 text-[11px] text-[var(--text-muted)]">
							{text(item, "occurredAt") || text(item, "updatedAt")}
						</p>
					</div>
				{:else}
					<p class="p-5 text-sm text-[var(--text-muted)]">No recent source rows available.</p>
				{/each}
			</div>
		</section>
	</div>

	<div class="rounded-xl border border-[var(--border-color)] p-4 text-xs text-[var(--text-muted)]">
		Mongoku does not own FOIL backlog, facts, reasoning, artifacts or code. Every report row remains traceable to its
		source authority. Missing optional FOIL collections are shown as unconfigured rather than created automatically.
	</div>
</section>
