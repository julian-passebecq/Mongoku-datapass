import { describe, expect, it } from "vitest";
import {
	assessProjection,
	findSecretLikeFields,
	parseProjection,
	PROJECTION_LIMITS,
	type ProjectionContext,
} from "$lib/datapass/projection";

const now = new Date("2026-09-25T12:00:00Z");

// Synthetic envelope following the galaxy identity envelope; no upstream app publishes one yet.
function overview(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		format: "atlasnote.planning-overview/1",
		projectRef: "atlasnote",
		sourceApp: "atlasnote",
		sourceObjectId: "planning-overview",
		sourceRevision: "rev-12",
		generatedAt: "2026-09-24T18:00:00Z",
		authority: "atlasnote",
		visibility: "private",
		freshness: "snapshot",
		counts: { open_tasks: 4, notes: 17, reading_queue: 3 },
		items: [{ id: "task-1", title: "Read the Fabric setup notes", status: "open", dueAt: "2026-09-26" }],
		...overrides,
	};
}

function assess(overrides: Partial<ProjectionContext> = {}) {
	return assessProjection({ now, enabled: true, raw: overview(), ...overrides });
}

describe("parseProjection", () => {
	it("accepts a bounded envelope and defaults lifecycle to current", () => {
		const parsed = parseProjection(overview());
		expect(parsed.ok).toBe(true);
		expect(parsed.ok && parsed.projection.lifecycle).toBe("current");
	});

	it("drops unknown fields instead of displaying them", () => {
		const parsed = parseProjection(overview({ body: "full note body" }));
		expect(parsed.ok && "body" in parsed.projection).toBe(false);
	});

	it("refuses more items than the bound", () => {
		const items = Array.from({ length: PROJECTION_LIMITS.items + 1 }, (_, i) => ({ id: "t" + i, title: "Task " + i }));
		const parsed = parseProjection(overview({ items }));
		expect(parsed).toMatchObject({ ok: false, reason: "invalid" });
	});

	it("refuses oversized payloads before anything else", () => {
		const parsed = parseProjection(overview({ padding: "x".repeat(PROJECTION_LIMITS.bytes) }));
		expect(parsed).toMatchObject({ ok: false, reason: "too_large" });
	});

	it("refuses links with embedded credentials or unsafe schemes", () => {
		expect(parseProjection(overview({ openUri: "https://user:pw@example.com/x" })).ok).toBe(false);
		expect(parseProjection(overview({ openUri: "javascript:alert(1)" })).ok).toBe(false);
		expect(parseProjection(overview({ openUri: "vscode://julian-passebecq.datapass-vscode/open?entity=x" })).ok).toBe(
			true,
		);
	});
});

describe("secret boundary", () => {
	it("refuses secret-like field names, even when the schema would strip them", () => {
		const parsed = parseProjection(overview({ extra: { client_secret: "abc", mongoPassword: "x" } }));
		expect(parsed).toMatchObject({ ok: false, reason: "secret_like" });
		expect(!parsed.ok && parsed.issues).toEqual([
			"extra.client_secret: secret-like field name",
			"extra.mongoPassword: secret-like field name",
		]);
	});

	it("refuses credential-like values and .env contents, reporting paths but never values", () => {
		const uri = "mongodb+srv://reader:hunter2@cluster0.example.net/db";
		const findings = findSecretLikeFields({
			items: [{ id: "a", title: uri }],
			note: "MONGODB_URI=abc\nCLOUDFLARE_ACCOUNT_ID=def\n",
		});
		expect(findings).toEqual(["items[0].title: credential-like value", "note: looks like .env contents"]);
		expect(findings.join(" ")).not.toContain("hunter2");
	});

	it("refuses secret wording in titles, including spaced key names", () => {
		for (const title of [
			"api key: rotate",
			"API Key = later",
			"client secret: rotate",
			"api_key: rotate",
			"token: rotate",
		]) {
			const parsed = parseProjection(overview({ items: [{ id: "t", title }] }));
			expect(parsed, title).toMatchObject({
				ok: false,
				reason: "secret_like",
				issues: ["items[0].title: credential-like value"],
			});
		}
		expect(parseProjection(overview({ items: [{ id: "t", title: "Rotate the API key" }] })).ok).toBe(true);
	});

	it("allows references and non-secret facts about secrets", () => {
		expect(
			findSecretLikeFields({
				credentialRef: "powerops:cloudflare/api",
				service_token_client_id: "4f1c.access",
				api_key_present: true,
				token_expected: true,
				secret_label: "Cloudflare API token (Power Ops vault)",
				env_file: ".env.local",
				required_keys: ["CLOUDFLARE_ACCOUNT_ID", "MONGODB_URI"],
			}),
		).toEqual([]);
	});

	it("never carries a refused payload into the assessment", () => {
		const result = assess({ raw: overview({ token: "sk-abcdefghijklmnopqrstu" }) });
		expect(result.availability).toBe("rejected");
		expect(result.projection).toBeUndefined();
		expect(JSON.stringify(result)).not.toContain("sk-abcdefghijklmnopqrstu");
		expect(result.nextAction.kind).toBe("export_projection");
	});
});

describe("assessProjection — distinct states and the smallest next action", () => {
	it("intentionally disabled is not failed", () => {
		const result = assess({ enabled: false, readError: "ignored" });
		expect(result).toMatchObject({ availability: "disabled", freshness: "not_applicable", issues: [] });
		expect(result.nextAction.kind).toBe("none");
	});

	it("an unreadable source is unavailable, and nothing is substituted", () => {
		const result = assess({ readError: "SOURCE_ERROR: connect ECONNREFUSED" });
		expect(result).toMatchObject({ availability: "unavailable", freshness: "unknown" });
		expect(result.projection).toBeUndefined();
		expect(result.nextAction.kind).toBe("open_source");
	});

	it("nothing published yet is neither an error nor invented data", () => {
		const result = assess({ raw: undefined });
		expect(result).toMatchObject({ availability: "not_published", freshness: "unknown" });
		expect(result.projection).toBeUndefined();
	});

	it("reachable and fresh does not mean reviewed", () => {
		const result = assess();
		expect(result).toMatchObject({ availability: "reachable", freshness: "fresh", reviewed: "unknown" });
		expect(result.nextAction.kind).toBe("none");

		const unreviewed = assess({ reviewed: { revision: "rev-11" } });
		expect(unreviewed).toMatchObject({ freshness: "fresh", reviewed: "not_reviewed" });
		expect(unreviewed.nextAction.kind).toBe("review_snapshot");
	});

	it("reviewed does not mean backed up", () => {
		const result = assess({
			reviewed: { revision: "rev-12" },
			backup: { expected: true, at: "2026-09-20T00:00:00Z" },
		});
		expect(result).toMatchObject({ reviewed: "reviewed", backedUp: "not_backed_up" });
		expect(result.nextAction.kind).toBe("back_up");

		const backedUp = assess({
			reviewed: { revision: "rev-12" },
			backup: { expected: true, at: "2026-09-25T00:00:00Z" },
		});
		expect(backedUp).toMatchObject({ backedUp: "backed_up", nextAction: { kind: "none" } });
	});

	it("an older snapshot than the latest published one asks for a refresh", () => {
		const result = assess({ latestPublished: { revision: "rev-13" } });
		expect(result.freshness).toBe("superseded");
		expect(result.nextAction).toEqual({
			kind: "refresh_projection",
			label: "AtlasNote planning overview is older than the latest published snapshot — refresh projection",
		});
	});

	it("an old current snapshot is stale", () => {
		const result = assess({ raw: overview({ generatedAt: "2026-09-01T00:00:00Z" }) });
		expect(result.freshness).toBe("stale");
		expect(result.nextAction.kind).toBe("refresh_projection");
	});

	it("historical and frozen snapshots are provenance, never stale errors", () => {
		for (const lifecycle of ["historical", "frozen"]) {
			const result = assess({
				raw: overview({ lifecycle, generatedAt: "2025-01-01" }),
				latestPublished: { revision: "rev-99" },
			});
			expect(result).toMatchObject({
				availability: "reachable",
				freshness: "not_applicable",
				nextAction: { kind: "none" },
			});
		}
	});

	it("a future timestamp is flagged instead of reported fresh", () => {
		const result = assess({ raw: overview({ generatedAt: "2026-10-01T00:00:00Z" }) });
		expect(result.freshness).toBe("unknown");
		expect(result.issues).toEqual(["generatedAt is in the future"]);
	});

	it("an unknown format is still assessed with a generic label", () => {
		const result = assess({ raw: overview({ format: "datapass-vscode.maintenance/1", sourceApp: "datapass-vscode" }) });
		expect(result.availability).toBe("reachable");
		expect(result.nextAction.label).toBe("Projection is current — no action");
	});
});
