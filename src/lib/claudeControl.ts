// Read-only client for Claude Control, Julian's local dashboard server (D:\PROJ\claude-control).
// The browser reads GET /api/status directly; Mongoku's server never calls it, and nothing here touches Mongo.
// Contract: claude-control docs/integrations/mongoku.md, approved 2026-09-25 for a read-only panel behind a flag.
import { z } from "zod";

export const CLAUDE_CONTROL_ORIGIN = "http://127.0.0.1:7430";
// The project key Claude Control uses for this repository (its folder name).
export const CLAUDE_CONTROL_PROJECT = "Mongoku-datapass";
export const CLAUDE_CONTROL_STATUS_URL =
	CLAUDE_CONTROL_ORIGIN + "/api/status?project=" + encodeURIComponent(CLAUDE_CONTROL_PROJECT);
// "#p.<project>" opens Claude Home zoomed on this project, so its tiles show the same numbers as the panel.
export const CLAUDE_CONTROL_HOME_URL = CLAUDE_CONTROL_ORIGIN + "/home.html#p." + CLAUDE_CONTROL_PROJECT;

const FETCH_TIMEOUT_MS = 3000;

const count = z.number().int().nonnegative();

const statusSchema = z.object({
	generated: z.string().nullish(),
	project: z.string().nullish(),
	sessions: z.object({ open: count, running: count, needs_you: count }),
	todo: count,
	// Added to Control after the first release; older servers omit it.
	to_check: count.optional(),
	open_prs: count,
	urgent: z
		.array(
			z.object({
				time: z.string().nullish(),
				source: z.string().nullish(),
				text: z.string(),
				link: z.string().nullish(),
			}),
		)
		.catch([]),
	latest_audit: z.object({ name: z.string().nullish(), status: z.string().nullish() }).catch({}),
});

export type ClaudeUrgentItem = { time?: string; text: string; link?: string };

export type ClaudeStatus = {
	generated?: string;
	openConversations: number;
	running: number;
	waitingOnYou: number;
	/** "Your to-do" on Claude Home: the "À faire par toi" rows plus the "À vérifier" rows. */
	todo: number;
	openPrs: number;
	urgent: ClaudeUrgentItem[];
	audit: { name?: string; status?: "green" | "orange" | "red"; emoji?: string };
};

const AUDIT_STATUS: Record<string, "green" | "orange" | "red"> = { "🟢": "green", "🟠": "orange", "🔴": "red" };

// Links come from local data, but still only reach the page through an allowlisted scheme.
function safeLink(link: string | null | undefined): string | undefined {
	if (!link) {
		return undefined;
	}
	return /^(https?|claude):\/\//i.test(link) ? link : undefined;
}

/**
 * Maps a /api/status payload to what the panel shows, or null when the payload is not a status for this project
 * (another service on the port, an older server that ignores ?project=, or a malformed body).
 */
export function parseClaudeStatus(payload: unknown, project = CLAUDE_CONTROL_PROJECT): ClaudeStatus | null {
	const parsed = statusSchema.safeParse(payload);
	if (!parsed.success || parsed.data.project !== project) {
		return null;
	}
	const data = parsed.data;
	const emoji = data.latest_audit.status ?? undefined;
	return {
		generated: data.generated ?? undefined,
		openConversations: data.sessions.open,
		running: data.sessions.running,
		waitingOnYou: data.sessions.needs_you,
		todo: data.todo + (data.to_check ?? 0),
		openPrs: data.open_prs,
		urgent: data.urgent.map((item) => ({
			time: item.time ?? undefined,
			text: item.text,
			link: safeLink(item.link),
		})),
		audit: {
			name: data.latest_audit.name ?? undefined,
			emoji,
			status: emoji ? AUDIT_STATUS[emoji] : undefined,
		},
	};
}

/**
 * Control only answers cross-origin reads from Mongoku's local dev server, and only runs on this PC.
 * On any other host (a deployed Mongoku) the panel stays off instead of firing requests that cannot succeed.
 */
export function canReachClaudeControl(hostname: string): boolean {
	return hostname === "localhost" || hostname === "127.0.0.1";
}

/** One read of /api/status. Never throws: Control being off, slow or incompatible all mean "hide the panel". */
export async function fetchClaudeStatus(fetchFn: typeof fetch = fetch): Promise<ClaudeStatus | null> {
	try {
		const response = await fetchFn(CLAUDE_CONTROL_STATUS_URL, {
			method: "GET",
			cache: "no-store",
			credentials: "omit",
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		});
		if (!response.ok) {
			return null;
		}
		return parseClaudeStatus(await response.json());
	} catch {
		return null;
	}
}
