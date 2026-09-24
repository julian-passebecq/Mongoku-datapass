# Codex support — Mongoku / Datapass control-plane
Date: 2026-09-24
Observed branch head before this note: 027bb95a42abee7486fc548959c42f702967be67
PR: #1

## Context

This note is a targeted support pass for the current Mongoku/Datapass control-plane work. It does not redefine FOIL authority and it does not replace the existing V4.1 report contract.

Current CI at 027bb95 is green. The old lockfile failure is resolved.

## Critical runtime mismatch discovered

The live registered DATAPASSCONTROL database was inspected directly:

- Atlas project: DATAPASSCONTROL
- cluster: ClusterDP
- database: dataprojects_control
- observed collections:
  - repositories
  - audit_runs
  - work_items
  - organizations
  - entities
  - events
  - relationships

The current app-owned workspace loader in:

`src/lib/server/datapassControl.ts`

expects:

- projects
- work_items
- agent_nodes
- instruction_profiles
- saved_queries
- source_catalog
- report_catalog
- workspace_presets
- system_nodes
- system_edges

and uses `projects` as the first existence check.

### Why this is a real bug

`loadControlWorkspace()` currently does roughly:

1. connect to configured control DB;
2. read `projects`;
3. if no projects -> return seed workspace;
4. catch any error -> return seed workspace.

Because the live database has `entities`, not `projects`, Mongoku can silently display seed/demo workspace data while a real populated DATAPASSCONTROL database exists.

This can make the UI appear healthy while being stale or incomplete.

## Required fix

Do not simply rename collections in the live database and do not create a second hidden source of truth.

Implement an explicit compatibility layer.

Recommended shape:

```text
control persistence modes

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

1. inspect collection availability explicitly;
2. if workspace-v1 collections exist, load workspace-v1;
3. otherwise if legacy-global collections exist, use a typed adapter;
4. otherwise use seed only when the DB is genuinely empty or control persistence is intentionally disabled;
5. never silently hide connection/schema/validation errors behind seed.

## Legacy adapter expectations

The legacy global schema is not field-compatible with workspace-v1.

Examples observed:

### entities

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

### work_items

```text
work_item_id
kind
project_id
priority = P0/P1/...
status = ongoing/open/ready/blocked/done/...
severity
title
summary
next_action
```

Do not feed those records directly through the current strict `projectSchema` / `workItemSchema`.

Create normalization functions with explicit provenance, for example:

```text
legacyEntityToProject()
legacyWorkItemToWorkspaceItem()
```

Do not lose original status/severity. Preserve them as raw metadata if a normalized UI state is required.

## Status mapping must be explicit

Current workspace status enums are much smaller than live status vocabularies.

Avoid regex-only destructive normalization in persistence.

Suggested display-only normalization:

```text
qualified/main/current/active/ongoing -> ACTIVE
ready/open/pending                  -> READY
blocked                             -> BLOCKED
done/complete/verified             -> DONE
planned/draft                       -> BACKLOG
otherwise                           -> UNKNOWN
```

Raw values remain authoritative in source records.

## Seed fallback bug

Current broad catch:

```ts
catch {
  return buildSeedWorkspace();
}
```

must not remain silent.

Return metadata capable of distinguishing at least:

```text
mongo
legacy-adapter
seed-empty
seed-disabled
fallback-error
```

If fallback-error occurs, surface a visible warning in the UI with a safe message.

A schema error, missing binding, or connection failure must not look like a normal seed workspace.

## Write safety

Do not run `saveControlWorkspace(..., "replace")` against the legacy `dataprojects_control` layout until the persistence mode is explicit.

The current replace path deletes every app-owned workspace-v1 collection. Even though those collections are currently absent, future mixed-mode deployments could become dangerous/confusing.

Required guard:

- persistence mode must be known;
- replace must target only the selected workspace-v1 namespace;
- legacy global graph collections are never erased by workspace replacement.

## FOIL report path

The V4.1 FOIL report fixes at the current head look materially better than the 2026-09-23 snapshot:

- propagation reads PM `events`, not nonexistent `propagation_queue`;
- Core conflict matcher includes `kind=conflict`;
- embedded backlog tasks are surfaced;
- query limits are bounded;
- registry-vs-binding mismatch can return explicit unavailable states.

Preserve these.

Do not merge FOIL detailed backlog into DATAPASSCONTROL work_items. FOIL reports remain source-aware reads from FOIL authorities.

## New FOIL state to be aware of

FOIL Project Instructions are now confirmed at V4.1.

The current Wind Design Lab route is now:

```text
PORT-WIND-CAO-LAB
-> ARCH-WIND-DESIGN-LAB-R0-20260924
-> RES-GITHUB-FOIL-STREAMLIT-WIND-3D-LCOE
-> julian-passebecq/foil-streamlit-wind-3d-lcoe
```

Legacy `foil-3d-stream` is now a donor/reference, not the active Design Lab implementation.

Mongoku should discover this through FOIL PM reports/resource_registry, not through hardcoded repo assumptions.

## Tests to add

Add regression tests for:

1. populated legacy DB + no projects collection -> legacy adapter, NOT seed;
2. empty DB -> seed-empty;
3. intentionally disabled control DB -> seed-disabled;
4. connection failure -> fallback-error surfaced;
5. workspace-v1 DB -> normal mongo mode;
6. legacy statuses remain available as raw status;
7. replace operation cannot delete legacy graph collections;
8. projects page clearly exposes whether its data is mongo/workspace-v1, legacy-adapter, or seed.

## Acceptance criteria

- CI remains green.
- A populated `dataprojects_control` with current live collection names is rendered from live data.
- No silent seed substitution for errors.
- FOIL report pages remain authority-aware and read-only.
- No new duplicate control database is created.
- No DATAPASSCONTROL legacy collection is deleted or migrated implicitly.
- UI visibly distinguishes source mode and source errors.

## Current evidence

GitHub:
- PR #1 open
- head 027bb95a42abee7486fc548959c42f702967be67
- push CI 36031341175 PASS
- PR CI 36031347051 PASS

Live Mongo inspection:
- dataprojects_control exists
- 7 collections observed
- non-empty entities/repositories/work_items/events/relationships/organizations/audit_runs
- no projects collection observed
- no source_catalog/report_catalog/workspace_presets collections observed

This is a runtime/data-contract issue, not a reason to redesign the whole application.
