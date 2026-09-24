/**
 * Bounded, single-project context bundles for handing work to Claude / Codex / ChatGPT or to
 * DataPass VS Code. Shape follows the `mongoku.portfolio-context` 0.1-proposal contract: one
 * scope, a purpose, source references with freshness, a capped item list and explicit
 * exclusions. Nothing outside the selected project is included, and every string is scrubbed
 * of credential-like values before it leaves the page.
 */
import type { CockpitProject, RecentEvent, WorkCard } from "./cockpit";

export type ContextPurpose = "ai_handoff" | "developer_handoff";

export type ContextItem = {
	id: string;
	kind: "WORK" | "TEST_GATE" | "CHANGE" | "CONFIG_REFERENCE" | "QUESTION";
	summary: string;
	assertion: "OBSERVED" | "USER_DECLARED" | "AI_PROPOSED" | "UNKNOWN";
	source_refs: string[];
};

export type ContextSource = {
	id: string;
	kind: "GITHUB" | "MONGO_METADATA" | "APP_EXPORT" | "USER_REPORT";
	locator: string;
	revision: string | null;
	observed_at: string | null;
	freshness: "CURRENT_FOR_DECLARED_SCOPE" | "STALE" | "UNKNOWN";
};

export type PortfolioContext = {
	format: "mongoku.portfolio-context";
	schema_version: "0.1-proposal";
	classification: "PRIVATE_REVIEW";
	generated_at: string;
	scope: { organization_id: string; project_id: string };
	purpose: string;
	project: {
		name: string;
		category?: string;
		status?: string;
		test_gate?: string;
		repo?: string;
		branch?: string;
		head?: string;
		ci?: string;
		runtime?: string;
		stop_point?: string;
		next_action?: string;
		mongoku_url?: string;
	};
	sources: ContextSource[];
	items: ContextItem[];
	exclusions: string[];
};

export const CONTEXT_LIMITS = { items: 50, sources: 20, work: 15, events: 5, summary: 2000 } as const;

const SECRET_PATTERNS: RegExp[] = [
	/mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi,
	/\b(?:postgres(?:ql)?|mysql|redis|amqp):\/\/[^\s"'`]+/gi,
	/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
	/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
	/\bsk-[A-Za-z0-9_-]{16,}\b/g,
	/\bAKIA[0-9A-Z]{16}\b/g,
	/\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
	/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
	/\b(password|passwd|pwd|secret|token|api[_-]?key|client[_-]?secret)\s*[:=]\s*[^\s,;"'`]+/gi,
];

/** Replaces credential-like substrings; applied to every string in an exported bundle. */
export function scrubSecrets(value: string): string {
	return SECRET_PATTERNS.reduce(
		(current, pattern) =>
			current.replace(pattern, (match, key?: string) =>
				typeof key === "string" && /[:=]/.test(match) ? key + "=[redacted]" : "[redacted]",
			),
		value,
	);
}

function scrubDeep<T>(value: T): T {
	if (typeof value === "string") {
		return scrubSecrets(value) as T;
	}
	if (Array.isArray(value)) {
		return value.map(scrubDeep) as T;
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, scrubDeep(nested)])) as T;
	}
	return value;
}

function clip(value: string | undefined, max: number = CONTEXT_LIMITS.summary): string {
	const text = (value ?? "").trim();
	return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function sourceFreshness(project: CockpitProject): ContextSource["freshness"] {
	if (project.freshness === "fresh") {
		return "CURRENT_FOR_DECLARED_SCOPE";
	}
	return project.freshness === "unknown" ? "UNKNOWN" : "STALE";
}

export function buildProjectContext(input: {
	project: CockpitProject;
	work: WorkCard[];
	events: RecentEvent[];
	purpose: ContextPurpose;
	mongokuUrl?: string;
	totalProjects?: number;
	generatedAt?: Date;
}): PortfolioContext {
	const { project } = input;
	const observedAt = project.lastVerifiedAt ?? project.updatedAt ?? null;
	const freshness = sourceFreshness(project);

	const sources: ContextSource[] = [
		{
			id: "mongo:entity:" + project.id,
			kind: "MONGO_METADATA",
			locator: "DATAPASSCONTROL/dataprojects_control/entities#" + project.id,
			revision: null,
			observed_at: observedAt,
			freshness,
		},
	];
	if (project.repo) {
		sources.push({
			id: "github:" + project.repo,
			kind: "GITHUB",
			locator: "https://github.com/" + project.repo + (project.branch ? "/tree/" + project.branch : ""),
			revision: project.head ?? null,
			observed_at: observedAt,
			freshness: project.head ? freshness : "UNKNOWN",
		});
	}
	for (const ref of project.sourceRefs) {
		if (sources.length >= CONTEXT_LIMITS.sources) {
			break;
		}
		sources.push({
			id: "ref:" + ref,
			kind: ref.startsWith("github:") ? "GITHUB" : "USER_REPORT",
			locator: ref,
			revision: null,
			observed_at: null,
			freshness: "UNKNOWN",
		});
	}

	// Callers may pass overlapping lanes (ready, blocked, all open work); keep one item per work id.
	// Entity gates are represented once, by the project's own test gate below.
	const ownWork = input.work.filter(
		(card, index, all) =>
			card.projectId === project.id &&
			card.source !== "entity_gate" &&
			all.findIndex((other) => other.id === card.id) === index,
	);
	const items: ContextItem[] = [];
	if (project.testReadiness) {
		items.push({
			id: "gate:" + project.id,
			kind: "TEST_GATE",
			summary: clip(project.testReadiness + (project.nextAction ? " — " + project.nextAction : "")),
			assertion: "OBSERVED",
			source_refs: ["mongo:entity:" + project.id],
		});
	}
	for (const card of ownWork.slice(0, CONTEXT_LIMITS.work)) {
		items.push({
			id: card.id,
			kind: card.kind === "test" ? "TEST_GATE" : "WORK",
			summary: clip(
				[card.priority, card.status, card.title].filter(Boolean).join(" · ") +
					(card.nextAction ? " — next: " + card.nextAction : ""),
			),
			assertion: "OBSERVED",
			source_refs: ["mongo:work_items#" + card.id],
		});
	}
	for (const event of input.events
		.filter((candidate) => candidate.projectId === project.id)
		.slice(0, CONTEXT_LIMITS.events)) {
		items.push({
			id: event.id,
			kind: "CHANGE",
			summary: clip(
				(event.observedAt ? event.observedAt + " " : "") + event.summary + (event.superseded ? " (superseded)" : ""),
			),
			assertion: "OBSERVED",
			source_refs: ["mongo:events#" + event.id],
		});
	}

	const runtime = project.runtime
		? [project.runtime.provider, project.runtime.url ?? project.runtime.urlStatus].filter(Boolean).join(" · ")
		: undefined;
	const ci = project.ci
		? [
				project.ci.result,
				project.ci.runs.length ? "runs " + project.ci.runs.join(", ") : "",
				project.ci.head ? "@" + project.ci.head : "",
			]
				.filter(Boolean)
				.join(" ")
		: undefined;

	const others = Math.max(0, (input.totalProjects ?? 1) - 1);
	const context: PortfolioContext = {
		format: "mongoku.portfolio-context",
		schema_version: "0.1-proposal",
		classification: "PRIVATE_REVIEW",
		generated_at: (input.generatedAt ?? new Date()).toISOString(),
		scope: { organization_id: project.organizationId ?? "independent", project_id: project.id },
		purpose:
			input.purpose === "developer_handoff"
				? "Developer handoff for " +
					project.name +
					": resume from the stop point, respect the test gate, report results back to Mongoku."
				: "Bounded AI handoff for " + project.name + ": continue the next action without redesigning the architecture.",
		project: {
			name: project.name,
			category: project.category,
			status: project.status,
			test_gate: project.testReadiness,
			repo: project.repo,
			branch: project.branch,
			head: project.head,
			ci,
			runtime,
			stop_point: project.stopPoint ? clip(project.stopPoint) : undefined,
			next_action: project.nextAction ? clip(project.nextAction) : undefined,
			mongoku_url: input.mongokuUrl,
		},
		sources: sources.slice(0, CONTEXT_LIMITS.sources),
		items: items.slice(0, CONTEXT_LIMITS.items),
		exclusions: [
			others > 0 ? others + " other portfolio project(s) excluded" : "No other portfolio projects included",
			"Domain-authority backlogs (for example FOIL Project Management) are referenced, never copied",
			"No credentials, connection strings, tokens or environment values",
			"Full document/library content (for example AtlasNote PDFs or notebooks) is not included",
		],
	};
	return scrubDeep(context);
}

export function contextToMarkdown(context: PortfolioContext): string {
	const project = context.project;
	const line = (label: string, value: string | undefined) => (value ? "- **" + label + ":** " + value + "\n" : "");
	let out =
		"# " + project.name + " — context (" + context.scope.organization_id + "/" + context.scope.project_id + ")\n\n";
	out += context.purpose + "\n\n## Current state\n";
	out += line("Status", project.status);
	out += line("Test gate", project.test_gate);
	out += line("Repo", project.repo);
	out += line("Branch", project.branch);
	out += line("Head", project.head);
	out += line("CI", project.ci);
	out += line("Runtime", project.runtime);
	out += line("Stop point", project.stop_point);
	out += line("Next action", project.next_action);
	out += line("Mongoku", project.mongoku_url);
	if (context.items.length > 0) {
		out += "\n## Work, gates and recent changes\n";
		for (const item of context.items) {
			out += "- [" + item.kind + "] " + item.summary + "\n";
		}
	}
	out += "\n## Sources\n";
	for (const source of context.sources) {
		out += "- " + source.locator + (source.revision ? " @ " + source.revision : "") + " (" + source.freshness + ")\n";
	}
	out += "\n## Not included\n";
	for (const exclusion of context.exclusions) {
		out += "- " + exclusion + "\n";
	}
	out +=
		"\n_Generated " +
		context.generated_at +
		" · " +
		context.classification +
		" · " +
		context.format +
		" " +
		context.schema_version +
		"_\n";
	return out;
}
