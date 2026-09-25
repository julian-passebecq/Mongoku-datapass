# Mongoku qualification handoff — 2026-09-25

**Branch:** `datapass/control-plane-v1` · **PR:** #1 → `master` (ready for review)
**Starting head:** `faa821bcb350884d85e53a5e5ffecbec72fbacd8`
**Qualified code head:** see the latest commit touching `src/` on the branch; CI evidence below (this document is committed on top of it)

Read after `docs/CLAUDE_FULL_HANDOFF_2026-09-24.md` and `docs/CODEX_SUPPORT_2026-09-24.md`. No architecture was redesigned; the legacy-global adapter was kept and only hardened where a defect was reproduced.

## Verdict on PR #1

**Ready to merge.** The connected read-only smoke against the real ClusterDP passed on 2026-09-25 (see [Connected smoke](#connected-smoke--real-clusterdp)). Every merge-gate item is met.

| Merge-gate item                         | State                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Final head CI green                     | ✅ push + PR CI on `78a42b2` (run IDs below)                                                                       |
| Connected DATAPASSCONTROL runtime smoke | ✅ Real ClusterDP, read-only (plus the earlier replica smoke)                                                      |
| Source-mode / fallback behaviour        | ✅ legacy-adapter, seed-disabled, fallback-error verified at runtime; seed-empty / mixed / error verified by tests |
| Workspaces                              | ✅ create from preset, blank, switch, per-workspace tabs/bookmarks, save/restore/undo, reload persistence          |
| No authority / write regression         | ✅ writes fail closed; ClusterDP unchanged after smoke (7 collections, same counts)                                |
| Home / portfolio UX usable              | ✅ Today, Ready to test, Blocked, Resume, Websites, Knowledge, Recent, reconciliation, project cards               |
| Known limitations documented            | ✅ below                                                                                                           |

## Evidence

### CI

- Code head `78a42b2`: push `Datapass Debug CI` **36066388912**, PR `CI` **36066395243** — see `gh run view <id>`.
- Local, on Windows (Node 26, pnpm 10.11.0 lockfile): `prettier --check` (only the git-excluded `.claude/launch.json` flagged), `eslint .` clean, `svelte-check` 0 errors (11 pre-existing warnings in untouched files), `vitest` 104 passed / 3 skipped (76 before), `vite build` OK, CLI `tsc` OK.

### Connected smoke — real ClusterDP

Run on 2026-09-25 from the user's machine (IP already on the DATAPASSCONTROL access list). The configuration was the MODE B+ block of `.env.example` in a gitignored `.env`; the user entered the password there, and it never passed through chat or logs.

- Header `Control source: legacy-adapter`; rail `Live · legacy-adapter`; Home `Source: live · DATAPASSCONTROL · dataprojects_control · 31 entities · 31 open work items · 2 organizations · read-only`, 31 cards.
- `/?org=foil` → 6 entities. The only reconciliation finding is `foil` / `foil_project` duplicate roots; Wind and Hydro now sit under `foil_project`.
- `/?org=datapass` → 10 entities, including `datapass_portfolio`, with no reconciliation finding (the default project is now a project entity). Ready 4, blocked 0.
- `/?project=mongoku_datapass` → 1 card; `TEST-MONGOKU` is in Ready to test and the gate conflict is gone.
- All 27 page and API routes returned 200 in 100–450 ms against real BSON data.
- `PUT /api/datapass/workspace` → 403; `/api/health` → `mongo-read-only`, `writesEnabled: false`.
- DATAPASSCONTROL afterwards: exactly the 7 collections, with the same counts (31 / 2 / 134 / 33 / 34 / 34 / 4). No `control_*` collection was created.

Also fixed after the replica smoke:

- **Mongo host unreachable → 30–90 s hangs.** Clients had no `serverSelectionTimeoutMS`, so the 30 s driver default applied. Measured with the source down: `/` went from 60.8 s to 5.3 s, `/projects` from 30.4 s to 5.2 s, and the report API from 59.6 s to 10.0 s; `/api/health` stayed under 0.1 s. The default is 5 s, set by `MONGOKU_SERVER_SELECTION_TIMEOUT_MS`; a URI that sets `serverSelectionTimeoutMS` keeps its own value. The Power Ops embedded-Mongoku test (PowerToy_UI PR #4) had reported this symptom and should now be re-run from the PowerToy_UI repo: `tests/native/web-embedded.ps1 -RealUrl http://localhost:3100/`.
- The Home no longer flags the intentionally bounded Recent list (latest 30 of 34 events) as a source problem.

### Runtime smoke — replica of live data

A read-only snapshot of `dataprojects_control` was captured through the MongoDB MCP (`find`/`aggregate` only): all 2 organizations, 30 entities, 34 work items, 23 relationships, the 12 latest events, and the 18 repository rows that match an entity's `canonical_repo`. It was loaded into a local `mongodb-memory-server` on `127.0.0.1:27018` with the same seven collection names, and the app ran under the **MODE B+** configuration now documented in `.env.example` (read-only, legacy adapter on, writes off). The snapshot and scripts stayed in a scratch directory and were not committed, because this repository is public.

Observed:

- Header `Control source: legacy-adapter`; rail `Live · legacy-adapter` with the 30 live entities plus the synthetic `Global Portfolio` node.
- Home `Source: live · DATAPASSCONTROL · dataprojects_control · 30 entities · 31 open work items · 2 organizations · read-only`.
- Today: Contoso, DataPass VS Code, Mosaic, PowerToy P0 tests, plus `B001` and `B002`. Ready to test: 7. Blocked: `TEST-MONGOKU-20260924`, `B004`.
- Websites: Avenzo → Vercel `https://avenzo-kappa.vercel.app/` (current production) + 4 Netlify fallbacks; Fornebu → Netlify `UNKNOWN_TO_VERIFY`.
- Knowledge: AtlasNote `METADATA_ONLY / AWAITING_BOUNDED_OVERVIEW_EXPORT`, with no invented counts.
- Filters: `?org=foil` → 6 entities; `?org=datapass` → 9; `?project=avenzo` → 1 card and a removable chip.
- Context export for `mongoku_datapass`: scope `datapass/mongoku_datapass`, "29 other portfolio project(s) excluded", and no other project's data in the payload.
- All 32 top-level routes and APIs returned 200.
- Writes: `PUT /api/datapass/workspace` returned 403; after the whole smoke the replica still had exactly the same 7 collections and counts, with no `control_*` collections.
- **Documented MODE B** (`DATAPASS_CONTROL_DISABLED=true`): Home stays live, and the rail shows seed projects labelled `DEMO SEED — not live data`.
- **Source down** (replica stopped): header `fallback-error — connect ECONNREFUSED`, Home `unavailable (SOURCE_ERROR) — … nothing is substituted`, 0 cards, rail labelled demo seed.
- Workspaces: Global → +FOIL preset (4 tabs) → +Datapass preset (4) → +Blank (1). A bookmark added in Blank is absent from FOIL. On FOIL: save checkpoint, close Calendar, restore (Calendar back, other workspaces untouched), then undo (Calendar closed again). After a full reload, all 4 workspaces, the active workspace, the checkpoint and the history persisted.

## Bugs fixed (all reproduced first)

1. **Every page 500'd in SSR** whenever the rail had projects: `ProjectRail` called `resolve()` on an already-resolved path, a regression from `1ffbd65`. (`52a66f2`)
2. **Home 500'd as soon as the global source was bound**: raw `ObjectId`/`Date`/`Long` values crossed the SvelteKit `load` boundary. Report rows are now converted to plain JSON in `finalizeRows`. (`52a66f2`)
3. **Workspace state leak**: creating or switching a workspace added the previous workspace's current page as a tab. (`52a66f2`)
4. **Checkpoints never worked**: `structuredClone` on Svelte proxies threw, so save/restore/undo failed. (`52a66f2`)
5. **Seed projects shown as if live** in the rail under the documented MODE B. (`52a66f2`)
6. **Writes were gated only by an env flag.** With `DATAPASS_CONTROL_WRITE_ENABLED=true` against the live DB, ChangeSet/history paths would have created `control_*` collections inside `dataprojects_control`, and `getWorkspaceIdentity` upserted `control_meta` even on a read. All write paths now go through `getWritableControlDb()`, which refuses any database that holds legacy graph collections. A workspace-v1 `replace` can no longer erase the shared `work_items`. (`0ca3be1`)
7. **Mixed layout**: an empty `projects` collection next to a populated legacy graph produced `seed-empty`. (`0ca3be1`)
8. **Status substring matching**: `partial_green`, `not_live_proven`, `incomplete` and `unresolved` normalized to `done`. Matching is now word-based; raw values are unchanged. (`0ca3be1`)
9. **Latent fallback on reconciliation**: the seed FOIL preset's `defaultProjectId: "foil"` would have invalidated the whole live workspace (→ `fallback-error`) once the legacy `foil` node is retired. Preset references are now rebound to live IDs. (`0ca3be1`)
10. Home counted `green`/`mitigated` rows as open work; the KPIs ignored the org filter; the repo lookup missed repos whose role is not `canonical_*`; and a source that was bound but unreachable was reported as "not bound". (`78a42b2`)

## Delivered product surface

- **Home cockpit** (`src/lib/datapass/cockpit.ts`, `src/routes/+page.svelte`) covering the items in the verdict table, with `?project=<entity_id>` as a stable deep link.
- **Reconciliation panel**, detected from data and never auto-fixed. On live data it reports three findings: `foil` / `foil_project` duplicate roots (with `foil_wind` and `foil_hydro` still parented to `foil`), `datapass` organization anchored on the Datapass Core product, and `TEST-MONGOKU-20260924` = `blocked` while the entity says `READY_FOR_CONNECTED_UI_SMOKE`.
- **Bounded context export** (`src/lib/datapass/aiContext.ts`) following the `mongoku.portfolio-context` 0.1-proposal shape: one project, ≤ 50 items, ≤ 20 sources, explicit exclusions, and credentials scrubbed. It has AI (Markdown/JSON) and developer (DataPass VS Code) variants.

## Known limitations

- **No `Open in DataPass VS Code` button.** `julian-passebecq/datapass-vscode` registers no URI handler (no `onUri` activation, no `registerUriHandler`), so a deep link would be invented. The integration today is _Developer context_ (stable `entity_id`, repo/branch/head, test gate, Mongoku URL). Proposed contract for the extension side: `vscode://julian-passebecq.datapass-vscode/open?entity=<entity_id>&mongoku=<url>`.
- **Observation, not changed:** `datapass-vscode` `package.json` reports `version: 0.9.2` while DATAPASSCONTROL records the audited runtime as v0.8.0. Re-audit before updating the record.
- **AtlasNote counts** appear only after a bounded overview is written to `entities.atlasnote.mongoku_projection.overview` (numeric fields plus `last_snapshot_at`). No ingestion endpoint was built.
- **Kanban / sprint writes not added.** The global graph stays read-only through Mongoku, and native planning writes need the ACL/revision/CAS design from the blueprint (`planning-change` 0.1-proposal).
- **FOIL PM was not bound** in the PR #1 smoke. It has been bound since the read-only federation (see [below](#read-only-mongo-federation--10-sources-2026-09-25)).
- **Power Ops summary card** not built; `/?project=<id>` and `/?org=<id>` are the URLs it should open.
- `readCollection` in the legacy path is bounded at 2000 rows with a visible truncation warning. Home report steps keep their existing per-step limits.

## Re-running the connected smoke

The smoke passed, as recorded above. To repeat it:

1. Put a ClusterDP URI in a local `.env` using the MODE B+ block of `.env.example`. Prefer a dedicated `read`-only user on `dataprojects_control` over the operator account.
2. Run `pnpm dev` and check the header, the rail and the Home source line against the results above.
3. Mongoku persists its connection list, URI included, in `MONGOKU_DATABASE_FILE` (the gitignored `.mongoku.db`). When `MONGOKU_DEFAULT_HOST` is set, it is authoritative on every start:
   - env servers missing from the file are added;
   - a persisted URI for the same server, such as an old credential, is replaced;
   - env entries no longer listed are dropped;
   - servers added from the UI are kept.

   No manual deletion is needed after a credential change, only a restart. Before this change, an existing file silently won over `.env`: Mongoku kept connecting as the operator account after `mongoku_readonly` was configured.

## DATAPASSCONTROL batch — applied 2026-09-25

This batch was approved by the user and applied through the MongoDB MCP, then verified by reading every record back. It is recorded as event `GLOBAL-PORTFOLIO-RECONCILIATION-2026-09-25`, whose `details.rollback` holds before-images of every changed field. Nothing was deleted, and FOIL Core Truth was not touched.

1. `work_items.TEST-MONGOKU-20260924`: `blocked` → `ready`, with CI and handoff evidence, then set to `done` after the connected smoke passed.
2. `entities.mongoku_datapass` and `repositories.julian-passebecq/Mongoku-datapass`: head `daa857e`, code head `78a42b2`, CI runs 36066516884 / 36066525144, status `pr_open_ci_green_replica_smoke_passed_connected_smoke_pending`, plus the new stop point and next action.
3. `foil_wind` and `foil_hydro` now have `parent_entity_id` = `foil_project` (`previous_parent_entity_id: foil` is kept). Relationship `FOIL-NAV-005` (`foil_project` contains Wind) was added. `foil` is retained, because relationships, `T004`/`B010`, 2 events and 4 repositories still reference it.
4. Entity `datapass_portfolio` was added, with relationships `DP-PORT-001..009` (`contains_product`) to the 9 Datapass-organization entities. This change is additive only: product parents and `organizations.datapass.default_project_id` (still `datapass`) are unchanged until their consumers are reviewed.

Follow-up, applied on user request: `organizations.datapass.default_project_id` switched from `datapass` to `datapass_portfolio`. Consumer check: in Mongoku only the Home reconciliation reads it, and GitHub code search over the owner's default branches found no other reader. The rollback is logged on the same event.

Still open: optionally re-parenting Datapass products under `datapass_portfolio`.

## Legacy `foil` node retirement — applied 2026-09-25

This batch was approved by the user and applied through the MongoDB MCP after Mongoku PR #3 was merged (`e838967`), then verified by reading every record back. It is recorded as event `FOIL-LEGACY-NODE-RETIREMENT-2026-09-25`, whose `details.rollback` holds the before-state of every changed field. Nothing was deleted, and FOIL Core Truth was not touched.

1. `FOIL-NAV-001` and `FOIL-NAV-004` pointed at `foil` but described Wind, duplicating `FOIL-NAV-005` and `R-FOIL-ITDEV-WIND`. Both are now `status: superseded` with `superseded_by`.
2. `R-FOIL-ITDEV-FOILPROJECT` now targets `foil_project` (`previous_to_id: foil`).
3. Work items `T004`/`B010` and repositories `foil_databrick_dab`, `databricks-vscode-foil`, `foil-ai-extension` and `foil-control-v1` now belong to `foil_it_dev`, the user's choice (`previous_project_id` / `previous_entity_id: foil`).
4. Entity `foil` is `status: retired_alias` with `alias_of: foil_project`. Its `canonical_repo` and `workspace_preset_id` stay as history, since Mongoku does not read them.
5. Unchanged: the two `foil` events and the `audit_runs` coverage lists, which are provenance.

Code support: `isFoilRootProject()` makes `foil` and `foil_project` open the same FOIL cockpit. A retired root with no children is no longer reported as a duplicate root. FOIL global references match every `foil*` project id, so work moved between FOIL entities stays visible.

Status normalization for report `displayStatus` now matches whole words, like the legacy adapter and cockpit. No live raw status maps to `UNKNOWN` any more.

## Read-only Mongo federation — 10 sources (2026-09-25)

Architecture event: `EVT-20260925-MONGOKU-READONLY-FEDERATION-10-SOURCES`, recorded in FOIL Project Management (`foil_project_management.events`) with status `VERIFIED`. Read back read-only.

The event title is "Mongoku read-only federation provisioned across 10 primary sources". A dedicated `mongoku_readonly` database user exists for DATAPASSCONTROL and for each of the nine primary FOIL Mongo authorities. Each user has only `read` on its intended database and is scoped to its intended cluster. No password is stored in PM.

Atlas side, verified with the Atlas API for all 10 projects:

- each `mongoku_readonly` user has one role, `read` on its database, and one scope, its cluster;
- the operator account is no longer in Mongoku's connection list.

Mongoku runtime:

- `MONGOKU_READ_ONLY_MODE=true` and `DATAPASS_CONTROL_WRITE_ENABLED=false`;
- health reports `mongo-read-only` with `writesEnabled: false`;
- DATAPASSCONTROL stays the global project and entity graph. Authority data is read in place and never copied into it.

Live result of `SOURCE_INVENTORY` (Mongoku PR #7, `173599f`), all read through the normal report engine path: logical source → FOIL PM `resource_registry` → binding → client.

| Source              | State        | Database                  | Collections | PM registry                      |
| ------------------- | ------------ | ------------------------- | ----------: | -------------------------------- |
| DATAPROJECTS_GLOBAL | RESOLVED, OK | `dataprojects_control`    |           7 | not applicable                   |
| FOIL_PM             | RESOLVED, OK | `foil_project_management` |           7 | is the registry                  |
| FOIL_CORE           | RESOLVED, OK | `foil_control`            |          10 | found                            |
| FOIL_STUDY          | RESOLVED, OK | `foil_study`              |           3 | found                            |
| FOIL_AI_REASONING   | RESOLVED, OK | `foil_ai_reasoning`       |           2 | found (lineage added, see below) |
| FOIL_IT_DEV         | RESOLVED, OK | `foil_it_dev`             |           4 | found                            |
| FOIL_FRONT          | RESOLVED, OK | `foil_front`              |           5 | found                            |
| FOIL_WORK_ARCHIVE   | RESOLVED, OK | `foil_work_archive`       |           4 | found                            |
| FOIL_DATABRICKS     | RESOLVED, OK | `foil_lab`                |           6 | found                            |
| FOIL_FABRIC         | RESOLVED, OK | `foil_fabric_lab`         |           1 | found                            |

The API response contains no URI, username or Atlas host. Mongo writes are blocked at three independent levels:

1. the Atlas `read` roles;
2. `checkReadOnly()` on every Mongo write command of the server browser;
3. an aggregation-stage allowlist that rejects `$out` and `$merge`, which the report engine also forbids.

No write probe was run against the authorities.

Defects found and fixed while wiring the federation:

1. **`.mongoku.db` silently won over `.env`.** Mongoku kept connecting with the operator account and loaded none of the new servers. Fixed in PR #5: an explicit `MONGOKU_DEFAULT_HOST` is now authoritative on every start (see [Re-running the connected smoke](#re-running-the-connected-smoke)). The new servers were then picked up by a reload with no manual cleanup.
2. **A leftover single-source `DATAPASS_SOURCE_BINDINGS` line** in the local `.env` came after the multi-source one and overrode it, so FOIL PM stayed unbound. It was commented out locally; this was a local configuration fix, not a code change.
3. **No report read AI Reasoning, IT DEV, FRONT, Databricks or Fabric,** so their resolution path was untested. PR #7 adds `SOURCE_INVENTORY`, one metadata-only section per catalog source, as a permanent smoke test of the federation. PR #9 then gives each of these five authorities its own report (see below).

To re-check the federation, call `GET /api/datapass/reports/SOURCE_INVENTORY` or open `/foil/report/SOURCE_INVENTORY`. Expect 10 sections with `trace.resolved: true`. Power Ops consumes the same endpoint and still needs no Mongo credentials.

### Authority reports for the five newly wired sources (PR #9, `8a873bf`)

Each of the five authorities that only `SOURCE_INVENTORY` read before now has its own report. Every report:

- uses its existing `sourceId` and the normal engine path (PM `resource_registry` → binding → client);
- is an `aggregate` with an explicit `$project` and a limit of at most 100, so large nested documents (prompts, CAD, lineage) never leave the source.

Projections and filters were written after inspecting the live documents (field inventory and status distribution per collection). "Current" sections exclude `SUPERSEDED`, `CANCELLED`, `HISTORICAL`, `LEGACY` and `MIGRATED` statuses. `SOURCE_INVENTORY` still counts every record.

| Report                     | Source              | Sections (live rows, 2026-09-25)                                                                                           |
| -------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `FOIL_AI_REASONING_RECENT` | `FOIL_AI_REASONING` | reasoning 7, boundary 1                                                                                                    |
| `FOIL_IT_DEV_STATUS`       | `FOIL_IT_DEV`       | current decisions 18 of 19, contracts 10, current architecture views 12 of 14                                              |
| `FOIL_FRONT_STATUS`        | `FOIL_FRONT`        | apps 12, current decisions 9 of 10, current visual specs 5 of 10, current visual versions 14 of 21                         |
| `FOIL_DATABRICKS_STATUS`   | `FOIL_DATABRICKS`   | work items 8, campaigns 2, studies 1, model profiles 1, machine contracts 2 (fact and unknown counts only), lab metadata 7 |
| `FOIL_FABRIC_STATUS`       | `FOIL_FABRIC`       | lab metadata 3                                                                                                             |

Semantic guarantees:

- **AI Reasoning is non-authoritative.** The report shows only records that declare `NON_AUTHORITATIVE_AI_REASONING`, and is labelled non-authoritative in its title, description and section authority. It never reads `FOIL_CORE` and is never merged with Core Truth.
- **Databricks** rows are lab control metadata, not measured evidence. Runtime, Gold tables and MLflow remain Databricks runtime authorities.
- **Fabric** is at setup stage. The report surfaces that the workspace and code repository are not registered, and claims no live deployment.

Qualification: every section of the five reports resolves `OK`, and `SOURCE_INVENTORY` is still 10/10. All 23 catalog reports (54 sections) resolve with no error state, and the five new report pages return 200. No response contains a URI, host or credential; three existing reports mention the name `mongoku_readonly` only inside source text such as events. CI passed; locally `vitest` passed (131), with `svelte-check` 0 errors, ESLint and Prettier clean, and the build passing.

Power Ops was notified of the report IDs and display rules. It consumes and displays the reports; FOIL business logic stays in Mongoku.

Resolved after PR #12 (2026-09-25, FOIL PM data only, no code change):

- **AI Reasoning registry lineage.** The `resource_registry` record `RES-MONGODB-FOIL-AI-REASONING` (a `MONGODB_ATLAS_REASONING_AUTHORITY`) had no linked database resource, so Mongoku fell back to the catalog database `foil_ai_reasoning`. FOIL PM now holds `RES-MONGO-PROJECT-FOIL-AI-REASONING` (FOIL AI Thinkink) → `RES-MONGO-CLUSTER-FOIL-AI-REASONING` (`ClusterFOILAI`) → `RES-MONGO-DB-FOIL-AI-REASONING` (`foil_ai_reasoning`), in the FOIL STUDY convention and checked against the Atlas API. The authority record points at the database through `parentResourceId`, the only link the engine walks. Only that field and `lineageRef` were added to it; it stays non-authoritative. Recorded as PM event `EVT-20260925-FOIL-AI-REASONING-REGISTRY-LINEAGE`, with its rollback. Live check: `SOURCE_INVENTORY` is still 10/10 OK, and the AI Reasoning trace now reports cluster `ClusterFOILAI`, its cluster and project IDs, and database `foil_ai_reasoning` from the registry. `FOIL_AI_REASONING_RECENT` is unchanged (reasoning 7, boundary 1).

Still open:

- **Cosmetic:** six keys are still defined twice in the local `.env` with identical values.
- **Planned, not started:** a cross-authority `FOIL_TECH_OVERVIEW` that composes signals from the per-authority reports. It is deliberately deferred until each source has its own clean semantics, which PR #9 provides.
