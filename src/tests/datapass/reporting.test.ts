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
	"FOIL_INSTRUCTION_DRIFT"
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
		const foilSources = sourceCatalog.filter(
			(source) => source.id.startsWith("FOIL_") && source.id !== "FOIL_PM"
		);
		expect(foilSources.length).toBeGreaterThan(0);
		for (const source of foilSources) {
			expect(source.registryAuthority, source.id).toBe("FOIL_PM");
		}
	});

	it("keeps the global portfolio source on dataprojects_control", () => {
		const source = sourceCatalog.find((candidate) => candidate.id === "DATAPROJECTS_GLOBAL");
		expect(source?.database).toBe("dataprojects_control");
		expect(source?.authority).toBe("DATAPASSCONTROL");
	});
});
