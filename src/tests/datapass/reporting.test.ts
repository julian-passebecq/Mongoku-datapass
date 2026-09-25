import { describe, expect, it } from "vitest";
import { reportCatalog, sourceCatalog } from "$lib/datapass/reporting";

const requiredFoilReports = [
	"FOIL_STATUS_NOW",
	"FOIL_NEXT",
	"FOIL_RECENT",
	"FOIL_P0_BLOCKERS",
	"FOIL_PROPAGATION_PENDING",
	"FOIL_APPS_IMPACTED",
	"FOIL_FRANCIS_QUESTIONS",
	"FOIL_MAINTENANCE_DUE",
	"FOIL_CONTRADICTIONS",
	"FOIL_ARCHITECTURE_MAP",
	"FOIL_PROJECTS",
	"FOIL_RESOURCE_INVENTORY",
	"FOIL_DOCUMENTS_RECENT",
	"FOIL_INSTRUCTION_DRIFT",
] as const;

const forbiddenStages = new Set(["$out", "$merge"]);

describe("FOIL report catalog", () => {
	it("contains every required FOIL report", () => {
		const ids = new Set(reportCatalog.map((report) => report.id));
		for (const reportId of requiredFoilReports) {
			expect(ids.has(reportId), reportId).toBe(true);
		}
	});

	it("keeps every FOIL report read-only", () => {
		for (const report of reportCatalog.filter((candidate) => candidate.scope === "FOIL")) {
			expect(report.readOnly, report.id).toBe(true);
			for (const step of report.steps) {
				expect(["find", "aggregate"]).toContain(step.operation);
			}
		}
	});

	it("references only declared source adapters", () => {
		const sourceIds = new Set(sourceCatalog.map((source) => source.id));
		for (const report of reportCatalog) {
			for (const step of report.steps) {
				expect(sourceIds.has(step.sourceId), report.id + " -> " + step.sourceId).toBe(true);
			}
		}
	});

	it("contains no write aggregation stage", () => {
		for (const report of reportCatalog) {
			for (const step of report.steps) {
				for (const stage of step.pipeline ?? []) {
					for (const key of Object.keys(stage)) {
						expect(forbiddenStages.has(key), report.id + " contains " + key).toBe(false);
					}
				}
			}
		}
	});

	it("routes FOIL domain sources through Project Management registry metadata", () => {
		const foilSources = sourceCatalog.filter((source) => source.id.startsWith("FOIL_") && source.id !== "FOIL_PM");
		expect(foilSources.length).toBeGreaterThan(0);
		for (const source of foilSources) {
			expect(source.registryAuthority, source.id).toBe("FOIL_PM");
		}
	});

	it("inventories every catalog source through the report engine", () => {
		const inventory = reportCatalog.find((report) => report.id === "SOURCE_INVENTORY");
		expect(inventory?.readOnly).toBe(true);
		expect(inventory?.steps.map((step) => step.sourceId)).toEqual(sourceCatalog.map((source) => source.id));
		for (const step of inventory?.steps ?? []) {
			expect(step.operation, step.id).toBe("inventory");
			// One unreachable authority must not break the other sections.
			expect(step.optional, step.id).toBe(true);
			expect(step.filter ?? step.pipeline, step.id).toBeUndefined();
		}
	});

	describe("federated FOIL authority reports", () => {
		const authorityReports: Record<string, string> = {
			FOIL_AI_REASONING_RECENT: "FOIL_AI_REASONING",
			FOIL_IT_DEV_STATUS: "FOIL_IT_DEV",
			FOIL_FRONT_STATUS: "FOIL_FRONT",
			FOIL_DATABRICKS_STATUS: "FOIL_DATABRICKS",
			FOIL_FABRIC_STATUS: "FOIL_FABRIC",
		};
		// Mirrors the report engine allowlist.
		const allowedStages = new Set([
			"$match",
			"$group",
			"$sort",
			"$project",
			"$limit",
			"$skip",
			"$unwind",
			"$count",
			"$addFields",
			"$set",
			"$unset",
			"$replaceWith",
			"$replaceRoot",
		]);

		it("gives each authority its own report that reads only that authority", () => {
			for (const [reportId, sourceId] of Object.entries(authorityReports)) {
				const report = reportCatalog.find((candidate) => candidate.id === reportId);
				expect(report, reportId).toBeDefined();
				expect(report?.readOnly).toBe(true);
				expect(new Set(report?.steps.map((step) => step.sourceId))).toEqual(new Set([sourceId]));
			}
		});

		it("bounds every step with an explicit projection, a limit and allowed stages only", () => {
			for (const reportId of Object.keys(authorityReports)) {
				const report = reportCatalog.find((candidate) => candidate.id === reportId)!;
				for (const step of report.steps) {
					const label = reportId + "/" + step.id;
					expect(step.operation, label).toBe("aggregate");
					expect(step.limit, label).toBeGreaterThan(0);
					expect(step.limit, label).toBeLessThanOrEqual(100);
					const stages = (step.pipeline ?? []).map((stage) => Object.keys(stage)[0]);
					expect(
						stages.every((stage) => allowedStages.has(stage)),
						label,
					).toBe(true);
					// Explicit field list: large nested documents (prompts, CAD, lineage) never leave the source.
					expect(stages, label).toContain("$project");
				}
			}
		});

		it("keeps AI Reasoning non-authoritative and separate from Core Truth", () => {
			const report = reportCatalog.find((candidate) => candidate.id === "FOIL_AI_REASONING_RECENT")!;
			expect(report.description).toMatch(/non-authoritative/i);
			expect(report.description).toMatch(/never FOIL Core Truth/i);
			expect(report.steps.every((step) => step.sourceId !== "FOIL_CORE")).toBe(true);
			expect(report.steps.every((step) => /non-authoritative/i.test(step.authority))).toBe(true);
			const reasoning = report.steps.find((step) => step.id === "reasoning")!;
			expect(reasoning.pipeline?.[0]).toEqual({ $match: { authorityBoundary: "NON_AUTHORITATIVE_AI_REASONING" } });
		});

		it("does not invent Fabric sections beyond lab_meta", () => {
			const report = reportCatalog.find((candidate) => candidate.id === "FOIL_FABRIC_STATUS")!;
			expect(report.steps.map((step) => step.collection)).toEqual(["lab_meta"]);
		});
	});

	it("keeps the global portfolio source on dataprojects_control", () => {
		const source = sourceCatalog.find((candidate) => candidate.id === "DATAPROJECTS_GLOBAL");
		expect(source?.database).toBe("dataprojects_control");
		expect(source?.authority).toBe("DATAPASSCONTROL");
	});
});
