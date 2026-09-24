# Claude full handoff — Mongoku / DataPass / FOIL

**Date:** 2026-09-24  
**Working branch:** `datapass/control-plane-v1`  
**Last fully qualified code checkpoint before this handoff:** `693e579bdd37381fcc61c83434fc04a0e1fed0da`  
**PR:** #1 -> `master`  
**Qualification at that checkpoint:** push CI `36042400306` SUCCESS, PR CI `36042404367` SUCCESS. Format, lint, typecheck, unit tests, application build and CLI build all passed.

This document is the primary implementation handoff for finishing Mongoku. Read it before changing architecture.

---

## 1. Product identity

Mongoku-datapass is **not a FOIL-only application**.

It is a generic, multi-organization, multi-project Mongo/control cockpit built on the Mongoku explorer.

Its responsibilities are:

- global portfolio visibility;
- organization/project/domain/tool navigation;
- ready-to-test / blocked / active / planned / legacy filtering;
- important cross-project work and verification queues;
- Mongo authority/report navigation;
- independent browser workspaces, tabs, bookmarks and saved states;
- reviewed AI/control-plane context where appropriate;
- bounded status projections from domain authorities;
- direct access to the original Mongo explorer.

FOIL is a major first consumer and validation case, but FOIL-specific detailed authority remains in FOIL's own databases.

Mongoku must also serve the **Datapass organization** and later other organizations without FOIL-specific assumptions in generic core code.

---

## 2. Relationship with DataPass VS Code

### Canonical VS Code extension repository

The DataPass VS Code developer-control-plane extension is:

```text
julian-passebecq/datapass-vscode
default branch: main
current observed head: 0cabcca908f05ba8c12c267465bf7194c309e850
```

This is the repository previously called **DataPass VS Code Galaxy / DataPass Control Plane**.

Do not confuse it with:

```text
julian-passebecq/ducklabms_code
```

which is currently represented in DATAPASSCONTROL as **Datapass Core**, a qualified earlier/local studio foundation and donor. It is not the canonical VS Code Galaxy extension.

Also keep separate:

```text
julian-passebecq/datapass-mosaic-vscode
```

which is the Datapass Workbench / Mosaic VS Code learning/workbench product.

### Complementarity

DataPass VS Code and Mongoku are complementary, not replacements for each other.

**DataPass VS Code**

- selected developer/work scope;
- Git and source revisions;
- cloud/tool qualification;
- Fabric / Databricks / Power BI / Grafana / Airflow / IaC context;
- project artifacts, contracts and native-tool handoffs;
- optional domain packs such as FOIL;
- developer execution preparation and receipts.

**Mongoku**

- enterprise/portfolio view;
- organizations and typed project/tool/domain nodes;
- global attention and test queue;
- authority/database discovery;
- cross-project navigation;
- independent browser workspaces and saved state;
- read-model views over FOIL and other authority systems.

### Integration direction

Do not merge the products or create duplicate authorities.

The useful integration is:

```text
Mongoku organization/project/workspace
  -> bounded context / stable project IDs / URLs
  -> Open in DataPass VS Code / Copy developer context

DataPass VS Code selected project/scope
  -> optional stable Mongoku project/workspace URL
  -> portfolio/authority status lookup
```

Use explicit context contracts, links, IDs and versioned snapshots. Do not share credentials through URLs or JSON exports.

Mongoku should eventually be callable/openable from DataPass VS Code as a specialized portfolio/Mongo cockpit, but DataPass VS Code remains usable without Mongoku and Mongoku remains usable without the extension.

---

## 3. Current global hierarchy model

Do **not** hard-code a fixed Company > Project > Subproject depth.

Use:

```text
organization
+ typed entity
+ optional parent_entity_id
+ typed relationships
```

The current global control database already uses this approach.

### Datapass

```text
Organization: Datapass
default_project_id: datapass

Datapass Core
  repo: julian-passebecq/ducklabms_code
  role: qualified earlier/core studio foundation and donor

DataPass VS Code Galaxy
  repo: julian-passebecq/datapass-vscode
  role: developer control-plane extension

Datapass Workbench / Mosaic VS Code
  repo: julian-passebecq/datapass-mosaic-vscode
  role: learning/data-engineering workbench

Mongoku Datapass / Mongo Control
  repo: julian-passebecq/Mongoku-datapass
  role: portfolio + Mongo cockpit

Contoso Data Studio
  repo: julian-passebecq/contoso-data-studio

plus Fabric tools/services and other products
```

### FOIL

Intended current model:

```text
Organization: FOIL
default_project_id: foil_project

foil_project
  role: macro coordination/product scope
  -> Wind domain
  -> Hydro domain [STOPPED]

foil_it_dev
  role: software/cloud/data architecture scope
  -> FOIL Hybrid Data Platform VNext [PROPOSED_NOT_DEPLOYED]
```

There is currently a cartography inconsistency in DATAPASSCONTROL:

- legacy/root node `foil` still exists;
- `foil_wind` and `foil_hydro` currently point to `foil`;
- organization `foil` already declares `default_project_id = foil_project`;
- `foil_project` is the newer macro coordination node.

Do not hide this with UI code. Treat it as a data reconciliation task. Preserve `foil` as legacy/alias/provenance until dependencies are checked.

---

## 4. Workspace model

The multi-workspace implementation is real and should be preserved.

A browser session can hold multiple independent `WorkspaceInstance` objects.

Each workspace owns:

- tabs;
- bookmarks;
- panel state;
- optional preset identity;
- default project;
- local saved checkpoints.

Implemented capabilities include:

- blank workspace;
- duplicate current workspace;
- switch workspace;
- close tabs;
- presets;
- browser local persistence;
- workspace checkpoint save;
- workspace/all-workspaces restore;
- pre-restore undo.

Current presets include:

```text
Global Macro
FOIL
Datapass
Mongo Focus
```

This is intentionally similar to the successful AtlasNote mental model: independent workspaces/sessions with tabs inside each workspace.

Do not collapse workspaces into ordinary tabs.

---

## 5. Live DATAPASSCONTROL database

Atlas:

```text
project: DATAPASSCONTROL
project id: 6ab286d91f303b893784fc72
cluster: ClusterDP
database: dataprojects_control
```

Observed collections:

```text
organizations
entities
work_items
repositories
relationships
events
audit_runs
```

This database is the **global multi-project control inventory** used by Mongoku/Datapass.

It is not FOIL Project Management.

Detailed FOIL backlog must not be copied into `dataprojects_control.work_items`.

### Important compatibility fix already completed

The app-owned workspace-v1 persistence model expects collections such as:

```text
projects
work_items
agent_nodes
instruction_profiles
saved_queries
source_catalog
report_catalog
workspace_presets
system_nodes
system_edges
```

The live global database uses `entities/work_items/...`, not `projects`.

Previously, `loadControlWorkspace()` could silently fall back to seed/demo data.

That bug is fixed on the qualified branch checkpoint.

Implemented:

- explicit `workspace-v1 / legacy-global / empty-or-unknown` detection;
- legacy `entities + work_items` typed adapter;
- preservation of raw source status/kind/priority/severity;
- explicit source mode;
- visible fallback/error mode;
- no silent error -> seed success;
- workspace writes fail closed on the legacy global graph;
- regression tests for legacy mapping and FOIL Hydro stopped state.

Do **not** rewrite this adapter unless a reproducible defect exists.

---

## 6. FOIL Mongo authority map

Claude has MongoDB Atlas access. Resolve current resources through FOIL PM `resource_registry` before assuming names or routes.

### Core operational authorities

| Authority          | Atlas project                                                                            | Database                  | Responsibility                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------- |
| Project Management | FOIL Project Management                                                                  | `foil_project_management` | Routing, portfolio, backlog, events, stakeholder questions, resource registry, architecture index |
| Core Truth         | FOIL Core Truth                                                                          | `foil_control`            | Accepted machine/evidence state, sources, validation                                              |
| STUDY              | FOIL STUDY                                                                               | `foil_study`              | Scientific paper/report decomposition and transferability                                         |
| AI Reasoning       | logical authority FOIL AI Reasoning; Atlas project currently labelled `FOIL AI Thinkink` | `foil_ai_reasoning`       | Durable non-authoritative rationale, hypotheses, derivations, validation plans                    |
| IT DEV             | FOIL IT DEV                                                                              | `foil_it_dev`             | Software/cloud/data architecture, contracts, ADRs                                                 |
| FRONT              | FOIL FRONT                                                                               | `foil_front`              | Front/application/visual representation state and decisions                                       |
| Work Archive       | FOIL Work Archive                                                                        | `foil_work_archive`       | Artifact provenance, checkpoints, material history                                                |
| Databricks Lab     | FOIL Databricks Lab                                                                      | `foil_lab`                | Frozen/versioned Databricks contracts, campaigns and model profiles                               |
| Fabric Lab         | FOIL Ms Fabric                                                                           | `foil_fabric_lab`         | Fabric lab/runtime metadata                                                                       |

Additional initialized domains exist, including:

```text
foil_oracle_lab
foil_business
```

These have narrow roles. Do not turn them into new global authorities.

### Optional / assurance / helper projects

Several Atlas projects exist for external audit, self-audit, helper/quarantine, backup candidates, user settings, support/read models, etc.

Do not route ordinary work to them just because they exist.

Normal routing remains:

```text
PM -> relevant domain authority -> code/runtime/archive as needed
```

### FOIL V4.1 operating rule

Conversation is working context, not another database.

Mongoku must not encourage a Mongo write after every chat or UI change.

Use Mongo when needed for:

- routing;
- durable decisions;
- accepted authority changes;
- milestone checkpoint;
- material provenance;
- bounded reports.

---

## 7. Current FOIL Wind route

Current PM routing:

```text
PORT-WIND-CAO-LAB
-> ARCH-WIND-DESIGN-LAB-R0-20260924
-> RES-GITHUB-FOIL-STREAMLIT-WIND-3D-LCOE
-> julian-passebecq/foil-streamlit-wind-3d-lcoe
```

The active Wind-only Design Lab repository is:

```text
julian-passebecq/foil-streamlit-wind-3d-lcoe
private
main
observed GitHub head: 7d18282312f75149c7417e5028db73c029b4fbb6
```

Legacy `foil-3d-stream` is a donor/reference, not the active Design Lab implementation.

A later local implementation pass has produced a qualified code handoff/snapshot with transactional candidate state, 3D/2D, Francis and cloud-bundle work. It has not yet been published to the private repo in the evidence available to this handoff. Do not claim it is in GitHub until the source head proves it.

FOIL machine truth remains separate in Core Truth.

---

## 8. Current DataPass VS Code state

Canonical extension repo:

```text
julian-passebecq/datapass-vscode
main
observed head: 0cabcca908f05ba8c12c267465bf7194c309e850
```

Important distinction:

- audited/implemented runtime baseline remains **v0.8.0**;
- V2.1 / V2.2 documents are implementation handoffs/specifications, not proof those features are shipped.

V2.2 direction includes:

- connected project contracts;
- I/O contracts;
- task-specific provider qualification;
- Programme view;
- FOIL optional domain pack;
- external app exchange;
- DiagramCloud contract;
- optional bounded Mongo context;
- evidence/publication gates.

Mongoku integration belongs as an external/specialized control surface, not duplicated code inside the VS Code extension.

---

## 9. Mongoku status to finish

Qualified code checkpoint:

```text
branch: datapass/control-plane-v1
code checkpoint: 693e579bdd37381fcc61c83434fc04a0e1fed0da
base master: 561a839c75280f90c5928932b441f9d4d1a312dd
ahead by: 343
behind by: 0
PR #1: OPEN, mergeable, clean
push CI 36042400306: SUCCESS
PR CI   36042404367: SUCCESS
```

This handoff commit will advance the branch head. Use the current branch head after reading this file.

The legacy-global adapter fix is complete and tested.

### Remaining Mongoku work

Prioritize runtime/product verification, not architecture reinvention.

1. **Connected smoke**
   - configure an authorized read-only DATAPASSCONTROL connection;
   - verify Home reads live `organizations/entities/work_items`, not seed;
   - confirm source mode is visible;
   - verify no workspace write capability is shown/enabled in legacy-adapter mode.

2. **Global Home UX**
   - Projects;
   - Important global work;
   - Blocked/waiting;
   - Ready to test;
   - FOIL P0 attention;
   - test/verification queue;
   - filters by organization, category and status.

3. **Workspaces**
   - create blank workspace;
   - create/apply Global, FOIL and Datapass presets;
   - multiple workspace switching;
   - tabs/bookmarks independent per workspace;
   - saved-state restore and undo;
   - refresh/persistence smoke.

4. **FOIL reports**
   - resource registry first;
   - PM/Core/Work Archive source traces;
   - no nonexistent `propagation_queue`;
   - no false empty-success when a source is unavailable;
   - FOIL detailed backlog remains in PM.

5. **Organization hierarchy**
   - expose organization + typed entities;
   - do not assume fixed hierarchy depth;
   - flag the `foil` vs `foil_project` data inconsistency;
   - do not silently migrate it in UI code.

6. **DataPass integration**
   - add bounded/open-link/context handoff contract only if it fits cleanly;
   - no shared secrets;
   - no hard dependency;
   - no duplicated DataPass VS Code developer-control logic.

7. **Preview/deployment**
   - qualify a safe read-only/private preview if environment and authorization allow;
   - public seed-only preview is acceptable for UI demo;
   - connected authority deployment must remain protected/read-only.

8. **Merge gate**
   - full CI green on final head;
   - runtime smoke evidence recorded;
   - no authority/write regression;
   - then PR #1 may merge.

---

## 10. Do not do

Do not:

- redesign Mongoku as FOIL-only;
- copy the FOIL detailed backlog into DATAPASSCONTROL;
- make DATAPASSCONTROL a replacement for FOIL PM;
- make Mongoku a scientific authority;
- make Mongoku a cloud scheduler;
- create a new duplicate `datapass_control` database automatically;
- silently seed on source errors;
- write to the legacy global graph through workspace replace/merge paths;
- hard-code FOIL repo names where PM resource resolution exists;
- confuse `ducklabms_code` with the DataPass VS Code extension;
- mark V2.2 DataPass handoff features as implemented unless source/runtime proves it;
- merge PR #1 merely because unit CI is green if connected UI smoke has not been done.

---

## 11. First actions for Claude

1. Read this file.
2. Read `docs/CODEX_SUPPORT_2026-09-24.md`.
3. Inspect current branch head and CI; do not assume the historical checkpoint is still head.
4. Inspect `src/lib/server/datapassControl.ts`, `src/lib/datapass/legacyGlobalAdapter.ts`, workspace store and Home/project routes.
5. Use Mongo read-only access to inspect `DATAPASSCONTROL.dataprojects_control`.
6. Run/repair connected local smoke.
7. Resolve reproducible product bugs only.
8. Leave FOIL cartography changes as an explicit reviewed data batch, not hidden code behavior.
9. Re-run format/lint/typecheck/tests/app build/CLI build.
10. Record exact head + CI/runtime evidence before recommending merge.

The goal is to **finish and qualify the product**, not start another architecture pass.
