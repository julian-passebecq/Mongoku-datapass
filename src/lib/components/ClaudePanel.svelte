<script lang="ts">
	import {
		CLAUDE_CONTROL_HOME_URL,
		CLAUDE_CONTROL_PROJECT,
		canReachClaudeControl,
		fetchClaudeStatus,
		type ClaudeStatus,
	} from "$lib/claudeControl";
	import { claudePanelFlag } from "$lib/stores/claudePanel.svelte";

	// Control rebuilds its data every few minutes; a missing server is retried rarely to keep the console quiet.
	const REFRESH_MS = 60_000;
	const RETRY_WHILE_OFF_MS = 180_000;
	const MIN_GAP_MS = 5_000;

	let status = $state<ClaudeStatus | null>(null);

	$effect(() => {
		claudePanelFlag.hydrate();
	});

	$effect(() => {
		if (!claudePanelFlag.enabled || !canReachClaudeControl(window.location.hostname)) {
			status = null;
			return;
		}

		let stopped = false;
		let inFlight = false;
		let lastAttempt = 0;
		let timer: ReturnType<typeof setTimeout> | undefined;

		async function load() {
			if (inFlight || stopped) {
				return;
			}
			inFlight = true;
			lastAttempt = Date.now();
			clearTimeout(timer);
			const next = await fetchClaudeStatus();
			inFlight = false;
			if (stopped) {
				return;
			}
			status = next;
			// A hidden tab skips the timed read; coming back to the tab reads again.
			timer = setTimeout(
				() => {
					if (document.visibilityState === "visible") {
						load();
					}
				},
				next ? REFRESH_MS : RETRY_WHILE_OFF_MS,
			);
		}

		function onReturn() {
			if (document.visibilityState === "visible" && Date.now() - lastAttempt > MIN_GAP_MS) {
				load();
			}
		}

		load();
		window.addEventListener("focus", onReturn);
		document.addEventListener("visibilitychange", onReturn);
		return () => {
			stopped = true;
			clearTimeout(timer);
			window.removeEventListener("focus", onReturn);
			document.removeEventListener("visibilitychange", onReturn);
		};
	});

	const AUDIT_LABEL = { green: "green", orange: "needs attention", red: "red" } as const;
</script>

{#if status}
	<section class="rounded-xl border border-[var(--border-color)]" data-testid="claude-panel" aria-label="Claude">
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--border-color)] px-4 py-3">
			<h2 class="text-sm font-semibold">Claude</h2>
			<p class="text-[10px] text-[var(--text-muted)]">
				{[
					"Claude Control",
					CLAUDE_CONTROL_PROJECT,
					"read-only",
					status.generated ? "data built " + status.generated.replace("T", " ") : "",
				]
					.filter(Boolean)
					.join(" · ")}
			</p>
			<!-- Claude Control is another app on this PC, not a Mongoku route. -->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href={CLAUDE_CONTROL_HOME_URL}
				target="_blank"
				rel="noreferrer"
				class="ml-auto rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium no-underline hover:bg-[var(--hover-background)]"
				>Open Claude Control</a
			>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</div>

		<div class="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 xl:grid-cols-6">
			<div data-testid="claude-open">
				<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Open conversations</p>
				<p class="mt-1 text-2xl font-semibold">{status.openConversations}</p>
				<p class="text-[10px] text-[var(--text-muted)]">{status.running} running</p>
			</div>
			<div data-testid="claude-waiting">
				<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Waiting on you</p>
				<p class="mt-1 text-2xl font-semibold" class:text-amber-600={status.waitingOnYou > 0}>
					{status.waitingOnYou}
				</p>
				<p class="text-[10px] text-[var(--text-muted)]">sessions to answer</p>
			</div>
			<div data-testid="claude-todo">
				<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Your to-do</p>
				<p class="mt-1 text-2xl font-semibold">{status.todo}</p>
				<p class="text-[10px] text-[var(--text-muted)]">tests, settings, decisions</p>
			</div>
			<div data-testid="claude-urgent">
				<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Urgent</p>
				<p class="mt-1 text-2xl font-semibold" class:text-amber-600={status.urgent.length > 0}>
					{status.urgent.length}
				</p>
				<p class="text-[10px] text-[var(--text-muted)]">alerts</p>
			</div>
			<div data-testid="claude-prs">
				<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Open pull requests</p>
				<p class="mt-1 text-2xl font-semibold">{status.openPrs}</p>
			</div>
			<div data-testid="claude-audit">
				<p class="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Latest audit</p>
				<p
					class="mt-1 text-2xl font-semibold"
					title={status.audit.status ? AUDIT_LABEL[status.audit.status] : "no status"}
				>
					{status.audit.emoji ?? "—"}
				</p>
				<p class="truncate text-[10px] text-[var(--text-muted)]">{status.audit.name ?? "none yet"}</p>
			</div>
		</div>

		{#if status.urgent.length > 0}
			<ul class="space-y-1 border-t border-[var(--border-color)] px-4 py-3 text-xs" data-testid="claude-urgent-list">
				{#each status.urgent as item, index (index)}
					<li>
						{#if item.link}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a href={item.link}>{item.text}</a>
						{:else}
							{item.text}
						{/if}
						{#if item.time}<span class="text-[10px] text-[var(--text-muted)]">
								· {item.time.replace("T", " ")}</span
							>{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}
