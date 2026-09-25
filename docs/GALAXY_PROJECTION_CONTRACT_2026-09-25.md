# Galaxy projection consumption contract — 2026-09-25

**Status:** contract and tests only. No upstream app publishes a projection yet, so Mongoku has no new route, UI, store or writer in this pass.
**Code:** [`src/lib/datapass/projection.ts`](../src/lib/datapass/projection.ts) (pure functions) · **Tests:** [`src/tests/datapass/projection.test.ts`](../src/tests/datapass/projection.test.ts)

Read after [`CLAUDE_QUALIFICATION_2026-09-25.md`](CLAUDE_QUALIFICATION_2026-09-25.md). Nothing here changes the 10-source federation, the five authority reports or the read-only boundary.

## Role

In the Datapass Galaxy (`capture → understand → work → verify → present → resume`), Mongoku is the **read-only cross-source lens**. It answers what exists, what is current/stale/blocked, where to open the source, and what bounded context to inspect next.

| Mongoku does                                                       | Mongoku never does                                |
| ------------------------------------------------------------------ | ------------------------------------------------- |
| read a projection an upstream app published and an operator stored | produce, edit, refresh or sync a projection       |
| show source, authority, timestamps, freshness and small counts     | copy note bodies, PDFs, diagrams or task backlogs |
| name the smallest next action                                      | run an agent, schedule work or write upstream     |
| offer _Open source_ / _Prepare context_ / _Copy prompt_            | receive a password, token or `.env` content       |

## Envelope

Every projection crossing into Mongoku uses the galaxy identity envelope, plus bounded counts and items. The schema is `projectionEnvelopeSchema`.

| Field            | Required | Meaning                                                                                                        |
| ---------------- | :------: | -------------------------------------------------------------------------------------------------------------- |
| `format`         |    ✓     | `<app>.<name>/<major>`, e.g. `atlasnote.planning-overview/1`. A major bump is a new contract.                  |
| `projectRef`     |    ✓     | Stable project ID. For DATAPASSCONTROL entities this is `entity_id`.                                           |
| `sourceApp`      |    ✓     | `powerops` · `atlasnote` · `datapass-vscode` · `diagramcloud` · `mongoku`                                      |
| `sourceObjectId` |    ✓     | Stable ID of the object in the source app.                                                                     |
| `sourceRevision` |          | Revision or snapshot ID; enables "superseded" and "reviewed" by revision.                                      |
| `generatedAt`    |    ✓     | When the upstream produced the snapshot. Never set by Mongoku.                                                 |
| `observedAt`     |          | When the underlying facts were observed, if different.                                                         |
| `openUri`        |          | Deep link back to the source. `https`, `http` or `vscode` only, no embedded credentials.                       |
| `authority`      |    ✓     | Which app or source owns the facts.                                                                            |
| `visibility`     |    ✓     | `private` or `shareable`.                                                                                      |
| `freshness`      |    ✓     | What the upstream claims: `snapshot`, `live` or `unknown`.                                                     |
| `lifecycle`      |          | `current` (default), `historical` or `frozen`. Historical and frozen snapshots are provenance and never stale. |
| `counts`         |          | At most 30 non-negative integer counts.                                                                        |
| `items`          |          | At most 25 `{ id, title, kind?, status?, dueAt?, openUri? }`, each text ≤ 500 characters.                      |

The whole payload is capped at 64 KiB. Unknown fields are dropped, never displayed.

### Expected upstream formats

| Format                           | Owner            | Mongoku shows                                                               | Must not contain                                                |
| -------------------------------- | ---------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `atlasnote.planning-overview/1`  | AtlasNote        | counts (open tasks, notes, reading queue, workspaces) + selected open tasks | note/PDF/notebook bodies, private annotations, reading history  |
| `diagramcloud.portfolio-index/1` | DiagramCloud     | revision, story present, public evidence count, open link                   | private nodes, private evidence, assets, the authoring document |
| DataPass maintenance (TBD)       | DataPass VS Code | env file/key present or missing (names only), branch/head, companion URL    | env values, secrets                                             |

Power Ops is not a projection source for Mongoku. It consumes Mongoku reports over HTTP and keeps its vault to itself.

## Where a projection lives

No new database and no ingestion endpoint. The existing read path is reused: DATAPASSCONTROL `entities.<projectRef>.mongoku_projection`, already read by `knowledgeOf()` in the Home cockpit (today `atlasnote` sits at `METADATA_ONLY / AWAITING_BOUNDED_OVERVIEW_EXPORT`, with no invented counts).

The write into that field is an **operator-approved batch** outside Mongoku (as for the 2026-09-25 DATAPASSCONTROL batches): export from the upstream app → review → store. Mongoku stays read-only (`writesEnabled: false`). When the first real projection is stored, `knowledgeOf()` should switch to `parseProjection()` and show only what validates.

## Secret boundary

`parseProjection()` runs size and secret checks **on the raw payload, before schema parsing**, so an unexpected extra field cannot slip through by being stripped. A payload with any finding is refused whole; only the path and the reason are reported, never the value.

Refused:

- field names such as `password`, `secret`, `client_secret`, `token`, `api_key`, `private_key`, `recovery_code`, `connection_string`, `dotenv`, `env_contents`;
- values matching the existing `scrubSecrets` patterns (Mongo/SQL URIs, GitHub/OpenAI/AWS/Slack tokens, JWTs, `password=…`);
- values that look like `.env` contents (two or more `KEY=` lines).

Allowed, because they describe a secret without carrying it: names ending in `_ref`/`Ref`, `_id`/`Id`, `_name`, `_label`, `_present`, `_missing`, `_expected`, `_exists`, `_at`, `_count`, `_status`. So `credentialRef`, `service_token_client_id`, `api_key_present` and `required_keys: ["MONGODB_URI"]` pass.

This fails closed: a task titled `api key: rotate` is refused too. The upstream fixes the wording and re-exports.

## States — kept distinct

`assessProjection()` never merges these:

| Axis         | Values                                                                  | Rule                                                                               |
| ------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| availability | `disabled` · `not_published` · `unavailable` · `rejected` · `reachable` | disabled is not failed; not published is not an error; reachable says nothing more |
| freshness    | `fresh` · `stale` · `superseded` · `unknown` · `not_applicable`         | older than the latest published revision → superseded; > 7 days → stale            |
| reviewed     | `reviewed` · `not_reviewed` · `unknown`                                 | by revision when both sides have one, else by time; never inferred                 |
| backedUp     | `backed_up` · `not_backed_up` · `not_expected` · `unknown`              | only when a backup is expected for that source                                     |
| lifecycle    | `current` · `historical` · `frozen`                                     | historical/frozen → freshness `not_applicable`, no action                          |

## Smallest next action

The first matching row wins. Mongoku only labels the action; at most it opens the source or prepares a bounded context for a person.

| Situation                                   | Action               | Label (example)                                                                   |
| ------------------------------------------- | -------------------- | --------------------------------------------------------------------------------- |
| module disabled for the project             | `none`               | Source intentionally disabled for this project — no action                        |
| store unreadable                            | `open_source`        | Source unavailable — check its binding, nothing is substituted                    |
| nothing stored                              | `export_projection`  | No projection published yet — export one from the source app when useful          |
| refused (secret-like / invalid / too large) | `export_projection`  | Projection refused: secret-like content — re-export without it                    |
| historical or frozen                        | `none`               | … kept as provenance, no refresh expected                                         |
| newer revision/time published upstream      | `refresh_projection` | AtlasNote planning overview is older than the latest published snapshot — refresh |
| `generatedAt` in the future                 | `open_source`        | … has an inconsistent timestamp — check the source                                |
| older than 7 days                           | `refresh_projection` | … is 24 days old — refresh projection                                             |
| fresh, not reviewed                         | `review_snapshot`    | New … not reviewed yet — open source to review                                    |
| reviewed, backup expected but older         | `back_up`            | … changed since the last backup — back it up at the source                        |
| otherwise                                   | `none`               | … is current — no action                                                          |

`prepare_context` is reserved for the maintenance rule "repo changed since the last qualification → prepare a bounded context", which reuses `mongoku.portfolio-context` (`aiContext.ts`). It needs an observed head versus a qualified head from a real source, so it is not wired yet.

## Future maintenance report

Add a `MAINTENANCE` report only once real upstream metadata exists. It answers: what needs reconciliation, which snapshot is stale, which source is unavailable, which repo changed since its last reviewed state, which backup or qualification is old or missing.

Signals Mongoku already has, which such a report could use without inventing anything:

- per-source reachability from `SOURCE_INVENTORY` (10/10 today);
- entity `last_verified_at` / `updated_at` freshness (Home cockpit);
- recorded `current_head` versus `ci_evidence.head` in DATAPASSCONTROL;
- existing reconciliation findings.

Acceptance for that report:

- `SOURCE_INVENTORY` still 10/10 and every current report still passes;
- one unavailable optional source does not break unrelated sections;
- timestamps and freshness are explicit on every row;
- no secret-like value in the response (the `projection.test.ts` secret checks apply);
- useful with zero agent execution.

## Non-goals

No live AtlasNote IndexedDB scraping, no Git password storage, no task CRUD, no agent scheduler, no automatic writes to external authorities, no duplicate DiagramCloud renderer, no migration of the 10-source federation.
