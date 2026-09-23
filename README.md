# Mongoku

[![CI](https://github.com/huggingface/Mongoku/actions/workflows/ci.yml/badge.svg)](https://github.com/huggingface/Mongoku/actions/workflows/ci.yml)

MongoDB client for the web. Query your data directly from your browser. You can host it locally,
or anywhere else, for you and your team.

It scales with your data (at Hugging Face we use it on a 1TB+ cluster) and is blazing fast for all
operations, including sort/skip/limit. Built on TypeScript/Node.js/SvelteKit.

You can even have mappings between documents to navigate your DB easily.

## Datapass Mongo Control fork

This fork keeps Mongoku as the lightweight MongoDB explorer and adds a project/AI control plane on top of it.

Main additions:

- project + subproject hierarchy
- project portfolio Kanban and work-item Kanban
- calendar and notes views backed by saved Mongo queries
- collapsible left project panel, right context/queries/settings panel, and tool ribbon
- persistent local tabs, bookmarks and multiple workspace instances
- AI-editable workspace presets stored in Mongo/JSON
- AI-role graph (leader, peers and recursive child agents)
- project-to-GitHub and project-to-Mongo context mappings
- versioned custom instruction profiles
- canonical JSON export/import for projects, queries, presets, instructions and graph data
- reviewed AI ChangeSets with preview, staging, selected-operation acceptance and stale-base rejection
- immutable control-plane revisions with A/B comparison and restore-as-new
- activity/audit log for staged, accepted, rejected and stale proposals
- saved local workspace checkpoints with automatic pre-restore undo
- read-only saved-query API for AI/tooling integrations
- original Mongoku explorer remains available under `/servers`

### Authority-aware sources and optional app persistence

Mongoku-datapass is a **control surface / query-report layer**. It does not require a Mongoku-owned MongoDB database to read existing authority systems.

The first serious integration is FOIL, whose authorities already exist independently. In particular:

- global project cartography: Atlas project `DATAPASSCONTROL`, cluster `ClusterDP`, database `dataprojects_control`
- detailed FOIL project/backlog/resource routing: `foil_project_management`
- accepted engineering truth: `foil_control`
- provenance/artifacts: `foil_work_archive`
- other FOIL authorities remain separate (STUDY, AI Reasoning, IT DEV, FRONT, Databricks, Fabric, etc.)

There is intentionally **no default `datapass_control` database** and this application does not create one implicitly.

#### Read-only source bindings

Logical source IDs live in the exported JSON/report catalog, but credentials do not. Connections are configured server-side:

```text
DATAPASS_CONTROL_DISABLED=true
DATAPASS_CONTROL_WRITE_ENABLED=false
MONGOKU_READ_ONLY_MODE=true
MONGOKU_DEFAULT_HOST="<private Mongo URIs separated by semicolons>"

DATAPASS_SOURCE_BINDINGS='{
  "DATAPROJECTS_GLOBAL":{"server":"<global-host-key>","database":"dataprojects_control"},
  "FOIL_PM":{"server":"<pm-host-key>","database":"foil_project_management"},
  "FOIL_CORE":{"server":"<core-host-key>","database":"foil_control"},
  "FOIL_WORK_ARCHIVE":{"server":"<archive-host-key>","database":"foil_work_archive"}
}'
```

FOIL resource discovery follows this rule:

1. read **FOIL Project Management `resource_registry` first**;
2. resolve canonical names, aliases, project/cluster/database/repository IDs and routes;
3. use provider-native enumeration only for discovery/verification;
4. never declare a registered resource absent merely because a provider list omitted it.

Saved reports can target several authority-native sources, but Mongoku composes results in the application layer rather than attempting arbitrary cross-database `$lookup` joins.

#### Optional Mongoku-owned persistence

AI ChangeSets, revision history and AI-editable source/report definitions can optionally be persisted by Mongoku. That mode is disabled until an explicit architectural decision selects the exact storage location.

If enabled, **both** values are mandatory:

```text
DATAPASS_CONTROL_DISABLED=false
DATAPASS_CONTROL_WRITE_ENABLED=true
DATAPASS_CONTROL_SERVER=<explicit configured connection>
DATAPASS_CONTROL_DATABASE=<explicit approved database>
```

There is no fallback to the first Mongo connection and no implicit database name.

When app-owned persistence is explicitly enabled, its collections are:

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
- `control_meta`
- `control_revisions`
- `control_changesets`
- `control_activity`

These application collections are configuration/history for Mongoku itself. They must not become detailed FOIL task, artifact, evidence or reasoning authorities.

### AI ChangeSets, JSON and saved-query APIs

```text
GET  /api/datapass/capabilities
GET  /api/datapass/workspace
PUT  /api/datapass/workspace

POST /api/datapass/changesets/preview
GET  /api/datapass/changesets
POST /api/datapass/changesets
POST /api/datapass/changesets/:id

GET  /api/datapass/history
POST /api/datapass/history/restore

POST /api/datapass/query/:queryId
GET  /api/datapass/reports/:reportId
```

The preferred AI workflow is:

1. read `/api/datapass/capabilities` and `/api/datapass/workspace`;
2. create a typed ChangeSet using the current `metadata.revision` and `metadata.fingerprint`;
3. preview it;
4. stage it for review;
5. explicitly accept selected operations or reject it.

If the workspace changed after the proposal was based, acceptance marks it stale and requires a fresh preview. Direct workspace PUT is retained for trusted manual initialization/administration and is revisioned. Full direct replacement still requires `confirmReplace: "replace-workspace"`.

Saved queries and report definitions are JSON data, not UI source code. They can declare a logical `sourceId`, authority/resource reference, database/collection, read-only `find` or aggregation logic, projections, parameters, presentation hints and refresh policy. Credentials remain server-side. Report definitions and source descriptors participate in the reviewed ChangeSet/revision model when app persistence is enabled.

Mongo credentials and connection strings are deliberately excluded from the workspace JSON export.

### Workspace state

Named workspace presets are part of the canonical Mongo/JSON workspace and can be edited by AI. The currently open tabs, bookmarks and panel state are stored in browser local storage for fast resume, and can be copied/imported as JSON from the right **Settings** panel.

**Workspace States** adds manual checkpoints of this local session state. A restore does not roll back Mongo project data. Every restore creates one automatic pre-restore undo point, and recent checkpoint activity is retained locally.

**History** is different: it versions canonical Mongo control-plane data. Accepted ChangeSets, direct JSON commits and restore-as-new operations create immutable revision snapshots that can be compared A/B.

### Vercel deployment

The repository is Vercel-ready through `@sveltejs/adapter-vercel`. `svelte.config.js` selects the Vercel adapter when `VERCEL=1`.

The committed `vercel.json` uses:

- framework: SvelteKit
- install: `pnpm install --no-frozen-lockfile`
- build: `pnpm build:app`
- Node.js 22 Vercel runtime
- seed-only/read-only control mode by default

The non-frozen Vercel install is temporary because the current branch adds `@sveltejs/adapter-vercel` in `package.json` while the upstream lockfile has not yet been regenerated on a normal development machine.

#### Safe public preview

The committed defaults intentionally do not connect to Mongo:

```text
DATAPASS_CONTROL_DISABLED=true
DATAPASS_CONTROL_WRITE_ENABLED=false
MONGOKU_READ_ONLY_MODE=true
MONGOKU_DISABLE_DEFAULT_HOSTS=true
MONGOKU_DATABASE_FILE=/tmp/.mongoku.db
```

This renders the full Mongo Control workspace using typed seed data without exposing an Atlas connection.

#### Private Mongo-connected deployment

For a private **read-only authority cockpit**, keep control persistence disabled and configure private Mongo connections plus `DATAPASS_SOURCE_BINDINGS` as Vercel environment variables. No Mongoku-owned database is required.

Only enable `DATAPASS_CONTROL_WRITE_ENABLED=true` if a separate architectural decision explicitly approves the app-owned persistence server/database. Keep any write-enabled deployment protected. Mongo credentials are never part of the workspace JSON export.

### Demo

https://github.com/user-attachments/assets/f37bee71-64f2-454a-a5d6-1697ba8aa070

## Installation & Usage

### Install Globally

This is the easiest way to use Mongoku:

```bash
# Install globally
npm install -g mongoku

# Start the server
mongoku

# Start with PM2
mongoku --pm2
# Start on a custom port
mongoku --port 8080
# Start in read-only mode
mongoku --readonly

# Stop the server with pm2
mongoku stop
```

#### Compatibility Version

For older MongoDB versions (< 4.2) or AWS DocumentDB (< 5.0), use the `compat` tag which includes an older driver:

```bash
# Install compat version globally
npm install -g mongoku@compat
```

### Using the Docker HUB image

```bash
docker run -d --name mongoku -p 3100:3100 huggingface/mongoku

# Run with customized default hosts
docker run -d --name mongoku -p 3100:3100 \
  --env MONGOKU_DEFAULT_HOST="mongodb://user:password@myhost.com:8888" \
  huggingface/mongoku
```

#### Compatibility Docker Image

For older MongoDB versions (< 4.2) or AWS DocumentDB (< 5.0), use the `compat` tag which includes an older driver:

```bash
docker run -d --name mongoku -p 3100:3100 huggingface/mongoku:compat

# Or use a specific version
docker run -d --name mongoku -p 3100:3100 huggingface/mongoku:2.4.3-compat
```

## Local Development

### Prerequisites

- Node.js 20+
- pnpm (will be auto-installed if using the `packageManager` field)

### Setup & Run

```bash
# Install dependencies
pnpm install

# Start development server (runs on port 3100)
pnpm dev
```

### Formatting

You can use `pnpm lint` and `pnpm format` to format the code.

You can use `npx simple-git-hooks` to set up git hooks

### Docker

#### Build your own image

If you want to build your own docker image, just clone this repository and run the following:

```bash
# Build
docker build -t yournamehere/mongoku .

# Build with a custom base path (e.g. to serve at /mongoku)
docker build --build-arg BASE_PATH=/mongoku -t yournamehere/mongoku .

# Run
docker run -d --name mongoku -p 3100:3100 yournamehere/mongoku

# Run with custom origin (if behind a reverse proxy)
docker run -d --name mongoku -p 3100:3100 \
  --env MONGOKU_SERVER_ORIGIN=https://mongoku.example.com \
  yournamehere/mongoku

# You can also use other MONGOKU_SERVER_* envs to let the reverse proxy determine
# the origin: MONGOKU_SERVER_HOST_HEADER, MONGOKU_SERVER_PROTOCOL_HEADER, ...
```

### Git hooks

You can run this command to set up pre-commit git hooks:

```shell
npx simple-git-hooks
```

## Configuration

You can configure Mongoku using environment variables.

### Build-time

```bash
# Serve Mongoku under a sub-path (e.g. behind a reverse proxy at /mongoku)
# Must be set at build time: BASE_PATH=/mongoku pnpm build
BASE_PATH=/mongoku
```

### Runtime

```bash
# Use customized default hosts (Default = localhost:27017)
MONGOKU_DEFAULT_HOST="mongodb://user:password@localhost:27017"

# Exclude specific databases from being displayed (comma-separated list)
MONGOKU_EXCLUDE_DATABASES="admin,config,local"

# See https://svelte.dev/docs/kit/adapter-node#environment-variables-port-and-host
MONGOKU_SERVER_PORT=8000
MONGOKU_SERVER_ORIGIN=https://mongoku.example.com

# Use a specific file to store hosts (Default = $HOME/.mongoku.db)
MONGOKU_DATABASE_FILE="/tmp/mongoku.db"

# Timeout for count in ms (Default = 30000)
MONGOKU_COUNT_TIMEOUT=5000

# Timeout for find queries in ms (Default = undefined, no timeout)
MONGOKU_QUERY_TIMEOUT=30000

# Read preference for queries (primary, primaryPreferred, secondary, secondaryPreferred, nearest)
MONGOKU_READ_PREFERENCE=secondaryPreferred

# Read preference tags as JSON array (used with MONGOKU_READ_PREFERENCE)
# Example: route to analytics nodes with fallback to any node
MONGOKU_READ_PREFERENCE_TAGS='[{"nodeType":"ANALYTICS"},{}]'

# Read-only mode (prevent write queries to mongodb)
MONGOKU_READ_ONLY_MODE=true

# Enable basic auth
MONGOKU_AUTH_BASIC=user:password

# --- OAuth2 PKCE authentication ---
# When MONGOKU_OAUTH_CLIENT_ID is set, OAuth is enabled and all users must
# authenticate through the configured OAuth provider. The application state
# (DB connections, etc.) is shared between all authenticated users.
# The callback URL to register with your provider is: {origin}{base_path}/auth/callback

# OAuth2 client ID (setting this enables OAuth)
MONGOKU_OAUTH_CLIENT_ID=my-client-id
# Use "__CIMD__" for automatic client ID discovery.
# In that mode, Mongoku serves the metadata document at:
#   {origin}{base_path}/.well-known/cimd.json
# and uses that URL as the OAuth client_id.
# MONGOKU_OAUTH_CLIENT_ID=__CIMD__
# OpenID Connect issuer URL (endpoints are discovered via .well-known/openid-configuration)
MONGOKU_OAUTH_ISSUER_URL=https://idp.example.com
# Secret for signing session cookies (any random string, keep it secret)
MONGOKU_OAUTH_SESSION_SECRET=change-me-to-a-random-string
# Scopes to request (Default = "openid profile email")
MONGOKU_OAUTH_SCOPES="openid profile email"
# Session duration in seconds (Default = 86400 = 24h)
MONGOKU_OAUTH_SESSION_DURATION=86400
# Restrict access to specific users by their "sub" claim (comma-separated)
# When set, only users whose sub is in this list can log in
MONGOKU_OAUTH_ALLOWED_SUBS=user-id-1,user-id-2
# Require a specific claim in the ID token (format: field=value)
# If the claim is an array, checks that the value is included
MONGOKU_OAUTH_REQUIRED_CLAIM=authority=admin

# Enable structured logging (JSON output)
# When enabled, all logs are output as JSON with timestamp, level, and request context
# HTTP requests are logged in both modes (simple text format when false, JSON when true)
MONGOKU_STRUCTURED_LOG=true

# Additional headers to log in structured logging (comma-delimited)
MONGOKU_LOG_HEADERS=x-amzn-oidc-identity,x-forwarded-for,x-custom-header

# Other reverse-proxy vars
MONGOKU_SERVER_HOST=127.0.0.1
MONGOKU_SERVER_PROTOCOL_HEADER=x-forwarded-proto
MONGOKU_SERVER_HOST_HEADER=x-forwarded-host
MONGOKU_SERVER_ADDRESS_HEADER=X-Forwarded-For
MONGOKU_SERVER_XFF_DEPTH=1
MONGOKU_SERVER_SHUTDOWN_TIMEOUT=30
MONGOKU_SERVER_SOCKET_PATH=/tmp/socket
```

## License

MIT
