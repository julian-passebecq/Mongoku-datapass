# Mongoku qualification handoff — 2026-09-25

**Branch:** `datapass/control-plane-v1` · **PR:** #1 → `master` (draft)
**Starting head:** `faa821bcb350884d85e53a5e5ffecbec72fbacd8`
**Qualified code head:** `78a42b247c5b1aa2ab9801a80c68fa51c081ce2c` (this document is committed on top of it)

Read after `docs/CLAUDE_FULL_HANDOFF_2026-09-24.md` and `docs/CODEX_SUPPORT_2026-09-24.md`. No architecture was redesigned; the legacy-global adapter was kept and only hardened where a defect was reproduced.

## Verdict on PR #1

**Not yet ready to merge.** One gate remains: the connected smoke against the real ClusterDP. It was deliberately not run in this pass, because no read-only DB credential was available to the app and creating Atlas users / access-list entries was out of scope. Everything else in the merge gate is met (see below). Running the checklist in [Remaining gate](#remaining-gate-connected-smoke) and getting the expected results is enough to recommend the merge.

| Merge-gate item                         | State                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Final head CI green                     | ✅ push + PR CI on `78a42b2` (run IDs below)                                                                       |
| Connected DATAPASSCONTROL runtime smoke | ⚠️ Replica only (live snapshot on a local mongod). **Real ClusterDP not run.**                                     |
| Source-mode / fallback behaviour        | ✅ legacy-adapter, seed-disabled, fallback-error verified at runtime; seed-empty / mixed / error verified by tests |
| Workspaces                              | ✅ create from preset, blank, switch, per-workspace tabs/bookmarks, save/restore/undo, reload persistence          |
| No authority / write regression         | ✅ writes fail closed; replica unchanged after smoke                                                               |
| Home / portfolio UX usable              | ✅ Today, Ready to test, Blocked, Resume, Websites, Knowledge, Recent, reconciliation, project cards               |
| Known limitations documented            | ✅ below                                                                                                           |

## Evidence

### CI

- Code head `78a42b2`: push `Datapass Debug CI` **36066388912**, PR `CI` **36066395243** — see `gh run view <id>`.
- Local, on Windows (Node 26, pnpm 10.11.0 lockfile): `prettier --check` (only the git-excluded `.claude/launch.json` flagged), `eslint .` clean, `svelte-check` 0 errors (11 pre-existing warnings in untouched files), `vitest` 104 passed / 3 skipped (76 before), `vite build` OK, CLI `tsc` OK.

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

- **No real ClusterDP smoke yet** (see the remaining gate).
- **No `Open in DataPass VS Code` button.** `julian-passebecq/datapass-vscode` registers no URI handler (no `onUri` activation, no `registerUriHandler`), so a deep link would be invented. The integration today is _Developer context_ (stable `entity_id`, repo/branch/head, test gate, Mongoku URL). Proposed contract for the extension side: `vscode://julian-passebecq.datapass-vscode/open?entity=<entity_id>&mongoku=<url>`.
- **Observation, not changed:** `datapass-vscode` `package.json` reports `version: 0.9.2` while DATAPASSCONTROL records the audited runtime as v0.8.0. Re-audit before updating the record.
- **AtlasNote counts** appear only after a bounded overview is written to `entities.atlasnote.mongoku_projection.overview` (numeric fields plus `last_snapshot_at`). No ingestion endpoint was built.
- **Kanban / sprint writes not added.** The global graph stays read-only through Mongoku, and native planning writes need the ACL/revision/CAS design from the blueprint (`planning-change` 0.1-proposal).
- **FOIL PM was not bound** in the smoke, so FOIL report pages were checked for HTTP 200 and "unbound" states only.
- **Power Ops summary card** not built; `/?project=<id>` and `/?org=<id>` are the URLs it should open.
- `readCollection` in the legacy path is bounded at 2000 rows with a visible truncation warning. Home report steps keep their existing per-step limits.

## Remaining gate: connected smoke

1. Put a **read-only** ClusterDP URI in a local `.env` using the MODE B+ block of `.env.example`.
2. Run `pnpm dev` and open `/`. Expect `Control source: legacy-adapter`, rail `Live · legacy-adapter`, and Home `Source: live · … 30 entities … 2 organizations · read-only`.
3. Open `/?org=foil`, `/?org=datapass` and `/?project=mongoku_datapass`, then check that the reconciliation panel lists the three findings above.
4. Confirm that `PUT /api/datapass/workspace` returns 403 and that `dataprojects_control` still has exactly its 7 collections.
5. If all of this holds, mark PR #1 ready and merge.

## Proposed DATAPASSCONTROL batch (not applied)

No Mongo writes were made in this pass. Suggested reviewed updates:

1. `work_items.TEST-MONGOKU-20260924`: its status (`blocked`, "rerun CI") is stale. After the connected smoke, set `ready` → `done` with evidence (heads and run IDs above).
2. `entities.mongoku_datapass` / `repositories.julian-passebecq/Mongoku-datapass`: update `current_head`/`active_head`, `ci_evidence`, `stop_point` and `next_action` to this handoff.
3. FOIL cartography: re-parent `foil_wind` and `foil_hydro` to `foil_project` and keep `foil` as legacy/alias. This is a reviewed batch only after dependency checks; the Mongoku presets already tolerate the change.
4. Datapass cartography: optional `datapass_portfolio` macro node. Keep the legacy `datapass` IDs until impact is reviewed.
