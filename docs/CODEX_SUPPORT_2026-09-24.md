# Codex support — Mongoku / Datapass control-plane

Date: 2026-09-24  
Observed implementation head before this note: `027bb95a42abee7486fc548959c42f702967be67`  
PR: #1

## Support-pass result

The live DATAPASSCONTROL compatibility bug described below has now been implemented and qualified on code head `09c1b009dd11964a316fca68a339df84a6a9d6b7`.

Qualification:

- push CI `36042020873`: SUCCESS;
- PR CI `36042023152`: SUCCESS;
- format, lint, typecheck, unit tests, app build and CLI build all passed;
- PR #1 is mergeable/clean at that checkpoint.

Implemented behavior:

- explicit `workspace-v1 / legacy-global / empty-or-unknown` persistence-mode detection;
- live `entities + work_items` compatibility adapter with raw source status preserved;
- explicit `sourceMode` metadata and visible fallback/error status;
- no silent seed substitution for connection/schema failures;
- workspace writes fail closed while connected to the legacy global graph;
- regression tests cover mode detection, entity/work-item mapping, stopped FOIL Hydro and global `portfolio` compatibility work.

The remaining work is product/runtime verification and any further workspace UX refinement; do not reimplement this adapter unless a reproducible defect is found.

## Context

This is a targeted support note for the current Mongoku/Datapass control-plane. It does not redefine FOIL authority and does not replace the existing V4.1 report contract.

The implementation head `027bb95...` had green push and PR CI. The old lockfile problem is resolved.

## Critical runtime mismatch discovered

The registered live DATAPASSCONTROL database was inspected directly:

- Atlas project: `DATAPASSCONTROL`
- cluster: `ClusterDP`
- database: `dataprojects_control`
- observed collections: `repositories`, `audit_runs`, `work_items`, `organizations`, `entities`, `events`, `relationships`

The current app-owned workspace loader in `src/lib/server/datapassControl.ts` expects:

- `projects`
- `work_items`
- `agent_nodes`
- `instruction_profiles`
- `saved_queries`
- `source_catalog`
- `report_catalog`
- `workspace_presets`
- `system_nodes`
- `system_edges`

and uses `projects` as the first existence check.

### Why this is a real bug

`loadControlWorkspace()` currently behaves approximately as follows:

1. Connect to the configured control database.
2. Read `projects`.
3. If there are no projects, return the seed workspace.
4. On any error, also return the seed workspace.

Because the live database has `entities`, not `projects`, Mongoku can silently display seed/demo workspace data while a populated DATAPASSCONTROL database exists.

That can make the UI look healthy while showing incomplete or stale control-plane state.

## Required fix

Do not rename live collections implicitly and do not create a second hidden source of truth.

Implement an explicit compatibility layer with two persistence shapes:

```text
WORKSPACE_V1
  projects
  work_items
  agent_nodes
  ...

LEGACY_GLOBAL_GRAPH
  entities
  repositories
  work_items
  events
  relationships
  organizations
  audit_runs
```

At load time:

1. Inspect collection availability explicitly.
2. If workspace-v1 collections exist, load workspace-v1.
3. Otherwise, if legacy-global collections exist, use a typed adapter.
4. Use seed only when the database is genuinely empty or control persistence is intentionally disabled.
5. Never silently hide connection, schema, or validation errors behind the seed.

## Legacy adapter expectations

The legacy global schema is not field-compatible with workspace-v1.

Observed `entities` fields include:

```text
entity_id
entity_type
name
category
status
canonical_repo
summary
organization_id
parent_entity_id
health
next_action
test_readiness
```

Observed `work_items` fields include:

```text
work_item_id
kind
project_id
priority
status
severity
title
summary
next_action
```

Do not feed these records directly through the current strict `projectSchema` and `workItemSchema`.

Create explicit normalization functions, for example:

```text
legacyEntityToProject()
legacyWorkItemToWorkspaceItem()
```

Preserve original status and severity as raw metadata when normalized UI states are needed.

## Status mapping

Persistence must keep raw statuses. Display normalization may use a bounded map such as:

```text
qualified/main/current/active/ongoing -> ACTIVE
ready/open/pending                  -> READY
blocked                             -> BLOCKED
done/complete/verified             -> DONE
planned/draft                       -> BACKLOG
otherwise                           -> UNKNOWN
```

Do not overwrite the source record with the normalized display value.

## Seed fallback

The current broad fallback:

```ts
catch {
  return buildSeedWorkspace();
}
```

must not remain silent.

Expose a source mode that distinguishes at least:

```text
mongo
legacy-adapter
seed-empty
seed-disabled
fallback-error
```

If `fallback-error` occurs, show a visible but safe warning in the UI.

A schema error, missing binding, or connection failure must not look like a normal seed workspace.

## Write safety

Do not run `saveControlWorkspace(..., "replace")` against the legacy `dataprojects_control` layout until persistence mode is explicit.

Required guardrails:

- persistence mode must be known;
- replace targets only the selected workspace-v1 namespace;
- legacy global graph collections are never erased by workspace replacement.

## FOIL report path

The V4.1 FOIL report fixes at `027bb95...` are materially better than the 2026-09-23 snapshot:

- propagation reads PM `events`, not nonexistent `propagation_queue`;
- Core conflict matching includes `kind=conflict`;
- embedded backlog tasks are surfaced;
- query limits are bounded;
- registry-vs-binding mismatches can return explicit unavailable states.

Preserve these behaviors.

Do not merge the detailed FOIL backlog into DATAPASSCONTROL `work_items`. FOIL reports remain source-aware reads from FOIL authorities.

## Current FOIL route

FOIL Project Instructions are now user-confirmed at V4.1.

The current Wind Design Lab route is:

```text
PORT-WIND-CAO-LAB
-> ARCH-WIND-DESIGN-LAB-R0-20260924
-> RES-GITHUB-FOIL-STREAMLIT-WIND-3D-LCOE
-> julian-passebecq/foil-streamlit-wind-3d-lcoe
```

Legacy `foil-3d-stream` is a donor/reference, not the active Design Lab implementation.

Mongoku should discover this through FOIL PM reports and `resource_registry`, not through hardcoded repo assumptions.

## Regression tests to add

1. Populated legacy DB with no `projects` collection -> legacy adapter, not seed.
2. Empty DB -> `seed-empty`.
3. Intentionally disabled control DB -> `seed-disabled`.
4. Connection or schema failure -> `fallback-error` is surfaced.
5. Workspace-v1 DB -> normal `mongo` mode.
6. Legacy statuses remain available as raw values.
7. Replace operation cannot delete legacy graph collections.
8. Projects page exposes whether data came from workspace-v1, legacy adapter, or seed.

## Acceptance criteria

- CI remains green.
- A populated `dataprojects_control` with the current live collection names is rendered from live data.
- No silent seed substitution occurs on errors.
- FOIL report pages remain authority-aware and read-only.
- No duplicate control database is created.
- No DATAPASSCONTROL legacy collection is deleted or migrated implicitly.
- The UI visibly distinguishes source mode and source errors.

## Evidence captured

GitHub at the implementation checkpoint:

- PR #1 open
- head `027bb95a42abee7486fc548959c42f702967be67`
- push CI `36031341175` PASS
- PR CI `36031347051` PASS

Live Mongo inspection:

- `dataprojects_control` exists;
- seven collections were observed;
- `entities/repositories/work_items/events/relationships/organizations/audit_runs` are populated;
- no `projects` collection was observed;
- no `source_catalog/report_catalog/workspace_presets` collections were observed.

This is a runtime/data-contract issue, not a reason to redesign the whole application.
