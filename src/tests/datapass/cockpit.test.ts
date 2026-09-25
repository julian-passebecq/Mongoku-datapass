import { describe, expect, it } from "vitest";
import { buildProjectContext, contextToMarkdown, scrubSecrets } from "$lib/datapass/aiContext";
import { buildCockpit, freshnessOf } from "$lib/datapass/cockpit";

const now = new Date("2026-09-24T21:00:00Z");

// Synthetic rows that mirror the live DATAPASSCONTROL field shapes.
const organizations = [
	{ organization_id: "acme", name: "Acme", default_project_id: "acme_project" },
	{ organization_id: "tools", name: "Tools", default_project_id: "tools_core" },
];

const entities = [
	{ entity_id: "acme_legacy", entity_type: "project", name: "Acme Project", organization_id: "acme", status: "active" },
	{
		entity_id: "acme_project",
		entity_type: "project",
		name: "Acme Project",
		organization_id: "acme",
		status: "active",
	},
	{
		entity_id: "acme_wind",
		entity_type: "domain",
		name: "Wind",
		organization_id: "acme",
		parent_entity_id: "acme_legacy",
		status: "active",
	},
	{
		entity_id: "acme_hydro",
		entity_type: "domain",
		name: "Hydro",
		organization_id: "acme",
		parent_entity_id: "acme_legacy",
		status: "stopped",
		next_action: "None while stopped.",
	},
	{
		entity_id: "tools_core",
		entity_type: "product",
		name: "Tools Core",
		organization_id: "tools",
		status: "qualified_main",
		canonical_repo: "owner/tools-core",
	},
	{
		entity_id: "cockpit",
		entity_type: "product",
		name: "Cockpit",
		organization_id: "tools",
		status: "pr_open_ci_green_runtime_smoke_pending",
		test_readiness: "READY_FOR_CONNECTED_UI_SMOKE",
		canonical_repo: "owner/cockpit",
		current_branch: "feature/x",
		current_head: "abc123",
		ci_evidence: {
			push_run: { $numberLong: "111" },
			pr_run: { $numberLong: "222" },
			result: "SUCCESS",
			head: "abc123",
		},
		pull_request: { number: 1, state: "open", draft: true },
		next_action: "Run the connected smoke.",
		last_verified_at: "2026-09-24T22:28:00+02:00",
		updated_at: "2026-09-24",
		source_refs: ["github:owner/cockpit#PR1"],
	},
	{
		entity_id: "site",
		entity_type: "website",
		category: "website",
		name: "Site",
		status: "deployed_active",
		canonical_repo: "owner/site",
		next_action: "Monitor production.",
		updated_at: "2026-09-10",
		runtime: {
			production_provider: "Vercel",
			production_url: "https://site.example.app/",
			historical_or_fallback_surfaces: ["Netlify:old-site"],
		},
	},
	{
		entity_id: "club",
		entity_type: "website",
		category: "website",
		name: "Club",
		status: "active_runtime_url_to_verify",
		runtime: { provider: "Netlify", production_url: null, production_url_status: "UNKNOWN_TO_VERIFY" },
		updated_at: "2026-09-24",
	},
	{
		entity_id: "vnext",
		entity_type: "architecture",
		name: "Proposed architecture",
		lifecycle: "proposed",
		status: "proposed_not_deployed",
		next_action: "Wait for approval.",
		updated_at: "2026-09-24",
	},
	{
		entity_id: "notes",
		entity_type: "product",
		name: "Notes",
		status: "active",
		updated_at: "2026-08-01",
		mongoku_projection: {
			mode: "METADATA_ONLY",
			mongo_sync_status: "AWAITING_BOUNDED_OVERVIEW_EXPORT",
			desired_fields: ["todo_count", "bookmark_count"],
			prohibited_default_copy: ["full_pdf_bytes"],
		},
	},
];

const repositories = [
	{
		repo: "owner/cockpit",
		entity_id: "cockpit",
		role: "canonical_product_repo",
		active_branch: "feature/x",
		active_head: "abc123",
		stop_point: "Adapter green; connected smoke remains.",
	},
	{ repo: "owner/cockpit-old", entity_id: "cockpit", role: "donor", stop_point: "Donor only." },
	// Registered under a family entity, but it is Site's canonical repo.
	{ repo: "owner/site", entity_id: "site_family", role: "separate_product", stop_point: "Live; monitor." },
];

const work = [
	{
		work_item_id: "TEST-COCKPIT",
		kind: "test",
		project_id: "cockpit",
		priority: "P0",
		status: "blocked",
		title: "Qualify cockpit",
		observed_at: "2026-09-23",
	},
	{
		work_item_id: "TEST-SITE",
		kind: "test",
		project_id: "site",
		priority: "P1",
		status: "ready",
		title: "Smoke site",
		observed_at: "2026-09-24",
	},
	{
		work_item_id: "T-PARTIAL",
		kind: "test",
		project_id: "tools_core",
		priority: "P1",
		status: "partial_green",
		title: "Partial",
		observed_at: "2026-09-21",
	},
	{ work_item_id: "T-DONE", kind: "test", project_id: "tools_core", priority: "P0", status: "green", title: "Done" },
	{
		work_item_id: "B-OPEN",
		kind: "backlog",
		project_id: "tools_core",
		priority: "P0",
		status: "ongoing",
		title: "Ongoing work",
		observed_at: "2026-09-22",
	},
];

const events = [
	{ event_id: "E1", project_id: "cockpit", observed_at: "2026-09-22", summary: "Older" },
	{ event_id: "E2", project_id: "site", observed_at: "2026-09-24T22:28:00+02:00", summary: "Newest" },
	{ event_id: "E3", project_id: "cockpit", observed_at: "2026-09-24", summary: "Superseded", superseded_by: "E9" },
];

const cockpit = buildCockpit({ organizations, entities, repositories, work, events, now });
const byId = (id: string) => cockpit.projects.find((project) => project.id === id);

describe("global cockpit read model", () => {
	it("builds project cards with repo, branch/head, CI, PR and canonical stop point", () => {
		const project = byId("cockpit");
		expect(project?.repo).toBe("owner/cockpit");
		expect(project?.branch).toBe("feature/x");
		expect(project?.head).toBe("abc123");
		expect(project?.ci).toEqual({ result: "SUCCESS", head: "abc123", runs: ["111", "222"] });
		expect(project?.pullRequest).toEqual({ number: 1, state: "open", draft: true });
		expect(project?.stopPoint).toBe("Adapter green; connected smoke remains.");
		expect(project?.freshness).toBe("fresh");
	});

	it("never treats partial or qualified statuses as finished work", () => {
		expect(byId("tools_core")?.openWork).toBe(2);
		expect(cockpit.blocked.map((card) => card.id)).toEqual(["TEST-COCKPIT"]);
	});

	it("lists ready work items and READY_* entity gates without duplicating a project", () => {
		const ids = cockpit.readyToTest.map((card) => card.id);
		expect(ids).toContain("TEST-SITE");
		expect(ids).toContain("gate:cockpit");
		expect(cockpit.readyToTest.filter((card) => card.projectId === "site")).toHaveLength(1);
	});

	it("puts only P0 actionable items on Today", () => {
		expect(cockpit.today.map((card) => card.id)).toEqual(["B-OPEN"]);
	});

	it("resumes active projects with a next action, most recently verified first, excluding stopped ones", () => {
		const ids = cockpit.resume.map((project) => project.id);
		expect(ids[0]).toBe("cockpit");
		expect(ids).not.toContain("acme_hydro");
		expect(ids).not.toContain("vnext");
	});

	it("distinguishes production, fallback and unknown website URLs without inventing one", () => {
		const site = cockpit.websites.find((project) => project.id === "site");
		const club = cockpit.websites.find((project) => project.id === "club");
		expect(site?.runtime).toEqual({
			provider: "Vercel",
			url: "https://site.example.app/",
			urlStatus: "production",
			fallbacks: ["Netlify:old-site"],
		});
		expect(site?.stopPoint).toBe("Live; monitor.");
		expect(club?.runtime?.url).toBeUndefined();
		expect(club?.runtime?.urlStatus).toBe("UNKNOWN_TO_VERIFY");
	});

	it("shows metadata-only knowledge projections without fabricating counts", () => {
		const notes = cockpit.knowledge.find((project) => project.id === "notes");
		expect(notes?.knowledge?.mode).toBe("METADATA_ONLY");
		expect(notes?.knowledge?.counts).toBeUndefined();
		expect(notes?.freshness).toBe("stale");
	});

	it("orders recent events across bare dates and timestamps and flags superseded ones", () => {
		expect(cockpit.recent.map((event) => event.id)).toEqual(["E2", "E3", "E1"]);
		expect(cockpit.recent.find((event) => event.id === "E3")?.superseded).toBe(true);
	});

	it("reports cartography issues as reconciliation findings instead of fixing them", () => {
		const ids = cockpit.reconciliation.map((finding) => finding.id);
		expect(ids).toContain("duplicate-root:acme:acme_legacy+acme_project");
		expect(ids).toContain("default-project-type:tools");
		expect(ids).toContain("gate-conflict:cockpit:TEST-COCKPIT");
		const duplicate = cockpit.reconciliation.find((finding) => finding.id.startsWith("duplicate-root"));
		expect(duplicate?.refs).toEqual(expect.arrayContaining(["acme_wind", "acme_hydro"]));
		// The source rows are untouched.
		expect(entities.find((entity) => entity.entity_id === "acme_wind")?.parent_entity_id).toBe("acme_legacy");
	});

	it("stops flagging a duplicate root once the legacy node is retired and childless", () => {
		const reparented = entities.map((entity) =>
			entity.parent_entity_id === "acme_legacy" ? { ...entity, parent_entity_id: "acme_project" } : entity,
		);
		const retired = reparented.map((entity) =>
			entity.entity_id === "acme_legacy" ? { ...entity, status: "retired_alias" } : entity,
		);
		const findingIds = (rows: typeof entities) =>
			buildCockpit({ organizations, entities: rows, repositories, work, events, now }).reconciliation.map(
				(finding) => finding.id,
			);

		// Re-parented but still active: two live roots with one name remain a finding.
		expect(findingIds(reparented)).toContain("duplicate-root:acme:acme_legacy+acme_project");
		expect(findingIds(retired).some((id) => id.startsWith("duplicate-root:acme"))).toBe(false);
		// Retired while children still point to it: still a finding.
		const retiredWithChildren = entities.map((entity) =>
			entity.entity_id === "acme_legacy" ? { ...entity, status: "retired_alias" } : entity,
		);
		expect(findingIds(retiredWithChildren)).toContain("duplicate-root:acme:acme_legacy+acme_project");
	});

	it("classifies freshness from the latest timestamp", () => {
		expect(freshnessOf([undefined], now)).toBe("unknown");
		expect(freshnessOf(["2026-09-20"], now)).toBe("aging");
	});
});

describe("bounded AI / developer context", () => {
	const project = byId("cockpit")!;
	const allCards = [...cockpit.blocked, ...cockpit.readyToTest];

	it("exports only the selected project with sources, exclusions and the contract header", () => {
		const context = buildProjectContext({
			project,
			work: allCards,
			events: cockpit.recent,
			purpose: "ai_handoff",
			mongokuUrl: "http://localhost/?project=cockpit",
			totalProjects: cockpit.projects.length,
			generatedAt: now,
		});
		expect(context.format).toBe("mongoku.portfolio-context");
		expect(context.schema_version).toBe("0.1-proposal");
		expect(context.scope).toEqual({ organization_id: "tools", project_id: "cockpit" });
		expect(context.items.every((item) => !item.id.includes("SITE"))).toBe(true);
		expect(context.items.map((item) => item.id)).toEqual(
			expect.arrayContaining(["gate:cockpit", "TEST-COCKPIT", "E3"]),
		);
		expect(context.sources[1]).toMatchObject({ kind: "GITHUB", revision: "abc123" });
		expect(context.exclusions[0]).toBe(cockpit.projects.length - 1 + " other portfolio project(s) excluded");
		expect(JSON.stringify(context)).not.toContain("Newest");
	});

	it("lists each work item and the entity gate once even when lanes overlap", () => {
		const context = buildProjectContext({
			project,
			work: [...cockpit.readyToTest, ...cockpit.blocked, ...cockpit.blocked],
			events: [],
			purpose: "ai_handoff",
		});
		const ids = context.items.map((item) => item.id);
		expect(ids).toEqual(["gate:cockpit", "TEST-COCKPIT"]);
	});

	it("caps items and sources", () => {
		const many = Array.from({ length: 80 }, (_, index) => ({ ...cockpit.blocked[0], id: "W" + index }));
		const context = buildProjectContext({ project, work: many, events: [], purpose: "developer_handoff" });
		expect(context.items.length).toBeLessThanOrEqual(50);
		expect(context.items.filter((item) => item.id.startsWith("W"))).toHaveLength(15);
		expect(context.sources.length).toBeLessThanOrEqual(20);
	});

	it("scrubs credential-like values from every exported string", () => {
		const leaky = {
			...project,
			nextAction: "Connect with mongodb+srv://user:hunter2@cluster.example.net/db and token=abc123def",
			stopPoint: "Used ghp_" + "a".repeat(36) + " for CI",
		};
		const context = buildProjectContext({ project: leaky, work: [], events: [], purpose: "ai_handoff" });
		const serialized = JSON.stringify(context) + contextToMarkdown(context);
		expect(serialized).not.toContain("hunter2");
		expect(serialized).not.toContain("abc123def");
		expect(serialized).not.toContain("ghp_aaaa");
		expect(scrubSecrets("password: s3cr3t")).toBe("password=[redacted]");
	});

	it("renders a readable markdown handoff", () => {
		const markdown = contextToMarkdown(
			buildProjectContext({ project, work: allCards, events: cockpit.recent, purpose: "ai_handoff", generatedAt: now }),
		);
		expect(markdown).toContain("# Cockpit — context (tools/cockpit)");
		expect(markdown).toContain("**Stop point:** Adapter green; connected smoke remains.");
		expect(markdown).toContain("## Not included");
	});
});
