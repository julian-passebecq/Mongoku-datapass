/**
 * Consumption contract for bounded projections published by other Datapass Galaxy apps
 * (`atlasnote.planning-overview/1`, `diagramcloud.portfolio-index/1`, later DataPass
 * maintenance observations). See docs/GALAXY_PROJECTION_CONTRACT_2026-09-25.md.
 *
 * Pure functions only: no I/O, no persistence, no writer. Mongoku reads a projection that its
 * upstream app published and an operator stored; it never produces, edits or refreshes one.
 * A projection carrying anything secret-like is refused as a whole, never partially shown.
 */
import { z } from "zod";
import { scrubSecrets } from "./aiContext";
import { timeOf } from "./cockpit";

export const PROJECTION_LIMITS = { bytes: 64 * 1024, items: 25, counts: 30, text: 500 } as const;

/** Formats Mongoku knows how to label. Others still validate against the generic envelope. */
export const KNOWN_PROJECTION_FORMATS = {
	"atlasnote.planning-overview/1": { app: "atlasnote", label: "AtlasNote planning overview" },
	"diagramcloud.portfolio-index/1": { app: "diagramcloud", label: "DiagramCloud portfolio index" },
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const OPEN_URI_PROTOCOLS = new Set(["https:", "http:", "vscode:"]);

const boundedText = z.string().min(1).max(PROJECTION_LIMITS.text);
const timestamp = z.string().refine((value) => Number.isFinite(timeOf(value)), "must be an ISO date or timestamp");
const openUri = z.string().refine((value) => {
	try {
		const url = new URL(value);
		return OPEN_URI_PROTOCOLS.has(url.protocol) && !url.username && !url.password;
	} catch {
		return false;
	}
}, "must be an http(s) or vscode link without embedded credentials");

const projectionItemSchema = z.object({
	id: boundedText,
	title: boundedText,
	kind: boundedText.optional(),
	status: boundedText.optional(),
	dueAt: timestamp.optional(),
	openUri: openUri.optional(),
});

export const projectionEnvelopeSchema = z.object({
	format: z.string().regex(/^[a-z0-9-]+\.[a-z0-9-]+\/\d+$/, "must look like <app>.<name>/<major>"),
	projectRef: boundedText,
	sourceApp: z.enum(["powerops", "atlasnote", "datapass-vscode", "diagramcloud", "mongoku"]),
	sourceObjectId: boundedText,
	sourceRevision: boundedText.optional(),
	generatedAt: timestamp,
	observedAt: timestamp.optional(),
	openUri: openUri.optional(),
	authority: boundedText,
	visibility: z.enum(["private", "shareable"]),
	freshness: z.enum(["snapshot", "live", "unknown"]),
	/** `historical` and `frozen` snapshots are provenance: they are never reported as stale. */
	lifecycle: z.enum(["current", "historical", "frozen"]).default("current"),
	counts: z
		.record(z.string().max(64), z.number().int().min(0))
		.refine((value) => Object.keys(value).length <= PROJECTION_LIMITS.counts, "too many count keys")
		.optional(),
	items: z.array(projectionItemSchema).max(PROJECTION_LIMITS.items).optional(),
});

export type ProjectionEnvelope = z.infer<typeof projectionEnvelopeSchema>;

// A key naming a secret is refused unless its suffix says it only carries a reference or a
// non-secret fact about it (`credentialRef`, `service_token_client_id`, `api_key_present`).
const SECRET_KEY =
	/passw(?:or)?d|passphrase|pwd|secret|token|api_?key|private_?key|recovery_?(?:code|key)|connection_?string|dotenv|env_?contents?/i;
const SAFE_KEY_SUFFIX =
	/(?:_ref|Ref|_id|Id|_name|Name|_label|Label|_present|Present|_missing|Missing|_expected|Expected|_exists|Exists|_at|At|_count|Count|_status|Status)$/;
const DOTENV_LINE = /^\s*(?:export\s+)?[A-Z][A-Z0-9_]*\s*=/gm;

function secretFindings(value: unknown, path: string, out: string[]): void {
	if (typeof value === "string") {
		if (scrubSecrets(value) !== value) {
			out.push(path + ": credential-like value");
		} else if ((value.match(DOTENV_LINE) ?? []).length >= 2) {
			out.push(path + ": looks like .env contents");
		}
		return;
	}
	if (Array.isArray(value)) {
		value.forEach((nested, index) => secretFindings(nested, path + "[" + index + "]", out));
		return;
	}
	if (value && typeof value === "object") {
		for (const [key, nested] of Object.entries(value)) {
			const keyPath = path ? path + "." + key : key;
			if (SECRET_KEY.test(key) && !SAFE_KEY_SUFFIX.test(key)) {
				out.push(keyPath + ": secret-like field name");
			}
			secretFindings(nested, keyPath, out);
		}
	}
}

/** Paths (never values) of every secret-like field or value in a raw payload. */
export function findSecretLikeFields(raw: unknown): string[] {
	const findings: string[] = [];
	secretFindings(raw, "", findings);
	return findings;
}

export type ParsedProjection =
	| { ok: true; projection: ProjectionEnvelope }
	| { ok: false; reason: "too_large" | "secret_like" | "invalid"; issues: string[] };

/**
 * Validates an upstream payload. The size and secret checks run on the raw input, before
 * schema parsing, so an unexpected extra field cannot slip through by being stripped.
 */
export function parseProjection(raw: unknown): ParsedProjection {
	const size = JSON.stringify(raw ?? null).length;
	if (size > PROJECTION_LIMITS.bytes) {
		return { ok: false, reason: "too_large", issues: [size + " bytes > " + PROJECTION_LIMITS.bytes] };
	}
	const secrets = findSecretLikeFields(raw);
	if (secrets.length > 0) {
		return { ok: false, reason: "secret_like", issues: secrets };
	}
	const parsed = projectionEnvelopeSchema.safeParse(raw);
	if (!parsed.success) {
		return {
			ok: false,
			reason: "invalid",
			issues: parsed.error.issues.map((issue) => (issue.path.join(".") || "(root)") + ": " + issue.message),
		};
	}
	return { ok: true, projection: parsed.data };
}

export type NextActionKind =
	| "none"
	| "open_source"
	| "export_projection"
	| "refresh_projection"
	| "review_snapshot"
	| "back_up"
	| "prepare_context";

export type ProjectionAssessment = {
	/** `reachable` only says a valid projection was read; freshness and review are separate. */
	availability: "disabled" | "not_published" | "unavailable" | "rejected" | "reachable";
	lifecycle?: ProjectionEnvelope["lifecycle"];
	freshness: "fresh" | "stale" | "superseded" | "unknown" | "not_applicable";
	reviewed: "reviewed" | "not_reviewed" | "unknown";
	backedUp: "backed_up" | "not_backed_up" | "not_expected" | "unknown";
	ageDays?: number;
	issues: string[];
	nextAction: { kind: NextActionKind; label: string };
	projection?: ProjectionEnvelope;
};

export type ProjectionContext = {
	now: Date;
	/** The module is switched off for this project on purpose. Disabled is not failed. */
	enabled: boolean;
	/** The stored payload; `undefined` when nothing has been published yet. */
	raw?: unknown;
	/** Set when the projection's store was expected but could not be read. */
	readError?: string;
	/** Latest revision/time the upstream is known to have published, when Mongoku has it. */
	latestPublished?: { revision?: string; at?: string };
	/** Last revision a person reviewed. Unknown stays unknown; it is never inferred. */
	reviewed?: { revision?: string; at?: string };
	backup?: { expected: boolean; at?: string };
	maxAgeDays?: number;
};

function labelOf(format: string | undefined): string {
	return (format && KNOWN_PROJECTION_FORMATS[format as keyof typeof KNOWN_PROJECTION_FORMATS]?.label) ?? "Projection";
}

function action(kind: NextActionKind, label: string): ProjectionAssessment["nextAction"] {
	return { kind, label };
}

/**
 * Classifies one stored projection and names the smallest next action. It never triggers the
 * action: Mongoku can at most open the source or prepare a bounded context for a person.
 */
export function assessProjection(context: ProjectionContext): ProjectionAssessment {
	const base = { reviewed: "unknown", backedUp: "unknown" } as const;
	if (!context.enabled) {
		return {
			...base,
			issues: [],
			availability: "disabled",
			freshness: "not_applicable",
			backedUp: "not_expected",
			nextAction: action("none", "Source intentionally disabled for this project — no action"),
		};
	}
	if (context.readError) {
		return {
			...base,
			issues: [context.readError],
			availability: "unavailable",
			freshness: "unknown",
			nextAction: action("open_source", "Source unavailable — check its binding, nothing is substituted"),
		};
	}
	if (context.raw === undefined) {
		return {
			...base,
			issues: [],
			availability: "not_published",
			freshness: "unknown",
			nextAction: action(
				"export_projection",
				"No projection published yet — export one from the source app when useful",
			),
		};
	}

	const parsed = parseProjection(context.raw);
	if (!parsed.ok) {
		return {
			...base,
			issues: parsed.issues,
			availability: "rejected",
			freshness: "unknown",
			nextAction: action(
				"export_projection",
				parsed.reason === "secret_like"
					? "Projection refused: secret-like content — re-export without it"
					: "Projection refused (" + parsed.reason + ") — re-export a bounded snapshot",
			),
		};
	}

	const projection = parsed.projection;
	const label = labelOf(projection.format);
	const issues: string[] = [];
	const generated = timeOf(projection.generatedAt);
	const now = context.now.getTime();
	const ageDays = Math.max(0, (now - generated) / DAY_MS);
	if (generated - now > CLOCK_SKEW_MS) {
		issues.push("generatedAt is in the future");
	}

	const reviewedRevision = context.reviewed?.revision;
	const reviewedAt = timeOf(context.reviewed?.at);
	const reviewed: ProjectionAssessment["reviewed"] =
		reviewedRevision && projection.sourceRevision
			? reviewedRevision === projection.sourceRevision
				? "reviewed"
				: "not_reviewed"
			: Number.isFinite(reviewedAt)
				? reviewedAt >= generated
					? "reviewed"
					: "not_reviewed"
				: "unknown";

	const backupAt = timeOf(context.backup?.at);
	const backedUp: ProjectionAssessment["backedUp"] = !context.backup?.expected
		? "not_expected"
		: Number.isFinite(backupAt)
			? backupAt >= generated
				? "backed_up"
				: "not_backed_up"
			: "unknown";

	const common = {
		availability: "reachable",
		lifecycle: projection.lifecycle,
		reviewed,
		backedUp,
		issues,
		projection,
	} as const;

	if (projection.lifecycle !== "current") {
		return {
			...common,
			freshness: "not_applicable",
			ageDays,
			nextAction: action("none", label + " is " + projection.lifecycle + " — kept as provenance, no refresh expected"),
		};
	}

	const latest = context.latestPublished;
	const newerRevision =
		!!latest?.revision && !!projection.sourceRevision && latest.revision !== projection.sourceRevision;
	const newerTime = Number.isFinite(timeOf(latest?.at)) && timeOf(latest?.at) > generated;
	if (newerRevision || newerTime) {
		return {
			...common,
			freshness: "superseded",
			ageDays,
			nextAction: action(
				"refresh_projection",
				label + " is older than the latest published snapshot — refresh projection",
			),
		};
	}
	if (issues.length > 0) {
		return {
			...common,
			freshness: "unknown",
			nextAction: action("open_source", label + " has an inconsistent timestamp — check the source"),
		};
	}
	if (ageDays > (context.maxAgeDays ?? 7)) {
		return {
			...common,
			freshness: "stale",
			ageDays,
			nextAction: action("refresh_projection", label + " is " + Math.floor(ageDays) + " days old — refresh projection"),
		};
	}
	if (reviewed === "not_reviewed") {
		return {
			...common,
			freshness: "fresh",
			ageDays,
			nextAction: action("review_snapshot", "New " + label + " not reviewed yet — open source to review"),
		};
	}
	if (backedUp === "not_backed_up") {
		return {
			...common,
			freshness: "fresh",
			ageDays,
			nextAction: action("back_up", label + " changed since the last backup — back it up at the source"),
		};
	}
	return { ...common, freshness: "fresh", ageDays, nextAction: action("none", label + " is current — no action") };
}
