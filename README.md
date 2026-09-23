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

### Control database

The project-management/control data is stored separately from the databases you inspect.

```bash
# Optional: choose a configured Mongoku connection by host name or connection id.
DATAPASS_CONTROL_SERVER=localhost:27017

# Default: datapass_control
DATAPASS_CONTROL_DATABASE=datapass_control

# Writes are OFF by default. Enable only on a local/private trusted instance.
DATAPASS_CONTROL_WRITE_ENABLED=true
```

When the control database is empty, the UI uses typed seed data. Enable writes on a trusted local/private instance and use **AI JSON > Direct JSON commit** once to initialize the control collections. After initialization, model-generated changes should normally use **AI Review** rather than direct workspace replacement.

Control collections:

- `projects`
- `work_items`
- `agent_nodes`
- `instruction_profiles`
- `saved_queries`
- `workspace_presets`
- `system_nodes`
- `system_edges`

Review/history collections are separate from the canonical workspace replacement set:

- `control_meta`
- `control_revisions`
- `control_changesets`
- `control_activity`

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
```

The preferred AI workflow is:

1. read `/api/datapass/capabilities` and `/api/datapass/workspace`;
2. create a typed ChangeSet using the current `metadata.revision` and `metadata.fingerprint`;
3. preview it;
4. stage it for review;
5. explicitly accept selected operations or reject it.

If the workspace changed after the proposal was based, acceptance marks it stale and requires a fresh preview. Direct workspace PUT is retained for trusted manual initialization/administration and is revisioned. Full direct replacement still requires `confirmReplace: "replace-workspace"`.

Saved queries are JSON data, not UI source code. They can define a collection, read-only `find`/aggregation logic, parameters, tags and presentation hints. The UI uses those definitions for portfolio status, project details, calendar and notes.

Mongo credentials and connection strings are deliberately excluded from the workspace JSON export.

### Workspace state

Named workspace presets are part of the canonical Mongo/JSON workspace and can be edited by AI. The currently open tabs, bookmarks and panel state are stored in browser local storage for fast resume, and can be copied/imported as JSON from the right **Settings** panel.

**Workspace States** adds manual checkpoints of this local session state. A restore does not roll back Mongo project data. Every restore creates one automatic pre-restore undo point, and recent checkpoint activity is retained locally.

**History** is different: it versions canonical Mongo control-plane data. Accepted ChangeSets, direct JSON commits and restore-as-new operations create immutable revision snapshots that can be compared A/B.

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
