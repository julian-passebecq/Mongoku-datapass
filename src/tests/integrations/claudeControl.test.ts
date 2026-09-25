import { describe, expect, it, vi } from "vitest";
import {
	CLAUDE_CONTROL_HOME_URL,
	CLAUDE_CONTROL_STATUS_URL,
	canReachClaudeControl,
	fetchClaudeStatus,
	parseClaudeStatus,
} from "$lib/claudeControl";

// Shape of GET http://127.0.0.1:7430/api/status?project=Mongoku-datapass observed on 2026-09-25.
function payload(overrides: Record<string, unknown> = {}) {
	return {
		generated: "2026-09-25T18:19",
		project: "Mongoku-datapass",
		plan: { five_hour: 53, week: 35, sampled: "2026-09-25T18:25" },
		sessions: { open: 2, running: 1, needs_you: 1 },
		todo: 2,
		to_check: 1,
		open_prs: 0,
		checks_to_act: 1,
		urgent: [
			{
				time: "2026-09-25T16:12",
				level: "urgent",
				source: "session",
				project: "Mongoku-datapass",
				text: "Waiting on you: Améliorer l'utilité des applications",
				link: "claude://claude.ai/epitaxy/local_a251e60b",
			},
		],
		latest_audit: { name: "2026-09-25-systeme", status: "🟠" },
		links: { local: "http://127.0.0.1:7430/home.html" },
		...overrides,
	};
}

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }) {
	return new Response(JSON.stringify(body), { ...init, headers: { "Content-Type": "application/json" } });
}

describe("parseClaudeStatus", () => {
	it("maps the status to the numbers Claude Home shows for the project", () => {
		const status = parseClaudeStatus(payload());
		expect(status).toEqual({
			generated: "2026-09-25T18:19",
			openConversations: 2,
			running: 1,
			waitingOnYou: 1,
			todo: 3,
			openPrs: 0,
			urgent: [
				{
					time: "2026-09-25T16:12",
					text: "Waiting on you: Améliorer l'utilité des applications",
					link: "claude://claude.ai/epitaxy/local_a251e60b",
				},
			],
			audit: { name: "2026-09-25-systeme", emoji: "🟠", status: "orange" },
		});
	});

	it("counts only the to-do rows when an older Control omits to_check", () => {
		const older: Record<string, unknown> = payload();
		delete older.to_check;
		expect(parseClaudeStatus(older)?.todo).toBe(2);
	});

	it("rejects a status that is not for this project", () => {
		expect(parseClaudeStatus(payload({ project: null }))).toBeNull();
		expect(parseClaudeStatus(payload({ project: "diagramcloud" }))).toBeNull();
	});

	it("rejects bodies that are not a Control status", () => {
		expect(parseClaudeStatus("<html>")).toBeNull();
		expect(parseClaudeStatus(null)).toBeNull();
		expect(parseClaudeStatus({ error: "not found" })).toBeNull();
		expect(parseClaudeStatus(payload({ sessions: { open: "2" } }))).toBeNull();
		expect(parseClaudeStatus(payload({ todo: -1 }))).toBeNull();
	});

	it("keeps only http(s) and claude:// links", () => {
		const status = parseClaudeStatus(
			payload({
				urgent: [
					{ text: "a", link: "javascript:alert(1)" },
					{ text: "b", link: "https://github.com/x/y/pull/1" },
					{ text: "c", link: null },
				],
			}),
		);
		expect(status?.urgent.map((item) => item.link)).toEqual([undefined, "https://github.com/x/y/pull/1", undefined]);
	});

	it("tolerates a missing audit and a malformed urgent list", () => {
		const status = parseClaudeStatus(payload({ latest_audit: { name: null, status: null }, urgent: "x" }));
		expect(status?.audit).toEqual({ name: undefined, emoji: undefined, status: undefined });
		expect(status?.urgent).toEqual([]);
	});
});

describe("fetchClaudeStatus", () => {
	it("reads the project status with a plain, credential-free GET", async () => {
		const fetchFn = vi.fn(async () => jsonResponse(payload()));
		const status = await fetchClaudeStatus(fetchFn as unknown as typeof fetch);
		expect(status?.waitingOnYou).toBe(1);
		expect(fetchFn).toHaveBeenCalledTimes(1);
		const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe("http://127.0.0.1:7430/api/status?project=Mongoku-datapass");
		expect(url).toBe(CLAUDE_CONTROL_STATUS_URL);
		expect(init).toMatchObject({ method: "GET", cache: "no-store", credentials: "omit" });
		expect(init.signal).toBeInstanceOf(AbortSignal);
	});

	it("returns null instead of throwing when Control is off", async () => {
		const refused = vi.fn(async () => {
			throw new TypeError("Failed to fetch");
		});
		await expect(fetchClaudeStatus(refused as unknown as typeof fetch)).resolves.toBeNull();
	});

	it("returns null on an error status or a body that is not JSON", async () => {
		const notFound = vi.fn(async () => jsonResponse({ error: "not found" }, { status: 404 }));
		await expect(fetchClaudeStatus(notFound as unknown as typeof fetch)).resolves.toBeNull();
		const html = vi.fn(async () => new Response("<html></html>", { status: 200 }));
		await expect(fetchClaudeStatus(html as unknown as typeof fetch)).resolves.toBeNull();
	});
});

describe("canReachClaudeControl", () => {
	it("only reads Control from a Mongoku served on this PC", () => {
		expect(canReachClaudeControl("localhost")).toBe(true);
		expect(canReachClaudeControl("127.0.0.1")).toBe(true);
		expect(canReachClaudeControl("mongoku.example.vercel.app")).toBe(false);
	});

	it("opens Claude Home zoomed on this project", () => {
		expect(CLAUDE_CONTROL_HOME_URL).toBe("http://127.0.0.1:7430/home.html#p.Mongoku-datapass");
	});
});
