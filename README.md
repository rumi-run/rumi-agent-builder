# RUMI Agent Builder

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Live app](https://img.shields.io/badge/Live-rumi.run%2Fbuilder-6366f1.svg)](https://rumi.run/builder/)
[![RUMI](https://img.shields.io/badge/RUMI-rumi.run-111827.svg)](https://rumi.run/)

**Plan and review AI agent systems on a shared canvas, then ship with confidence.**

RUMI Agent Builder is an open source workspace for **designing, documenting, and collaborating** on agent architectures before they touch production. Map models, tools, memory, guardrails, and handoffs as first-class blocks. Invite stakeholders into the same diagram, comment on specifics, and walk the room in presentation mode. When the design is ready, export to HTML or JSON and keep a version-friendly history in SQLite, with optional AI assistance wired to your own provider.

| | |
|:--|:--|
| **Try it** | [rumi.run/builder](https://rumi.run/builder/) |
| **License** | [MIT](./LICENSE) |
| **Source** | [github.com/rumi-run/rumi-agent-builder](https://github.com/rumi-run/rumi-agent-builder) |

---

## Why teams use Agent Builder

Modern agent stacks are easy to **underestimate and hard to explain**. Prompts hide in repos, policy lives in slides, and “the system” exists only in someone’s head. That gap creates misaligned launches, fragile handoffs, and reviews that skim the surface instead of the structure.

**Agent Builder exists to make agent design legible.** It gives product, engineering, and compliance a **single visual language** for how data flows, who decides what, and where risk is controlled. You move from vague intent to an inspectable graph: inputs, outputs, tools, memory, guardrails, and connectors you can step through together.

**Collaboration is the default, not an afterthought.** Share links, organizations, live cursors, and block-level comments turn the canvas into a **shared studio**. Stakeholders react to the same artifact, not a static export.

**It respects how real teams ship.** Email-based sign-in, admin controls, AI-assisted drafting against **your** configured model, exports for walkthroughs, and self-hosted setup that writes core config to `.env` so operators stay in control.

In short: **clarity before code, alignment before scale,** and a path from whiteboard to something your team can actually run and defend.

---

## What you get

| Capability | Details |
|------------|---------|
| **Visual agent canvas** | Drag-and-drop graph, **13** block types (LLM, tools, memory, guardrails, I/O, logic, subagents, and more), undo/redo, auto-save, keyboard shortcuts |
| **AI-assisted design** | Generate or refine instructions, validate structure, suggest blocks, draft agent intros. Admins attach **your** provider, endpoint, and model. |
| **Real-time collaboration** | WebSocket presence, cursors, synced edits, comments pinned to blocks |
| **Access & teams** | Email OTP sessions, share links (view/edit), organizations and invites |
| **Export & review** | HTML and JSON export, presentation mode for structured walkthroughs |
| **Operations** | Node.js API, SQLite persistence, health check, optional **external auth bridge** (same-site cookie + internal `/me`) if you configure it |
| **Administration** | AI settings, user directory, usage visibility, optional community template review (super admin) |
| **Self-hosted onboarding** | Guided setup at `/builder/setup` for SMTP, admin emails, and optional encryption secrets (persists to `.env`) |

---

## Architecture at a glance

| Layer | Stack |
|-------|--------|
| **Client** | React, Vite, Tailwind, React Flow-style canvas, Zustand |
| **Server** | Node.js, Express, SQLite (schema + migrations), WebSocket collaboration |
| **Auth** | **Default:** email OTP via this app (`/api/builder/auth`). **Optional:** point `VITE_AUTH_API_BASE` at a separate login API behind your reverse proxy, and set server **auth bridge** env vars so sessions from that service are recognized (see below). |

See **Repository layout** for paths and modules.

---

## Quick start

```bash
git clone https://github.com/rumi-run/rumi-agent-builder.git
cd rumi-agent-builder

npm install
cd client && npm install && cd ..

cp .env.example .env
# Configure .env, or finish the in-app wizard under First-time configuration.

npm run dev
```

| URL | Role |
|-----|------|
| `http://localhost:5173/builder/` | Web UI (Vite; proxies `/api/builder` to the API in dev) |
| `http://localhost:3020/api/builder/health` | Health check |

**npm scripts**

| Command | What it does |
|---------|----------------|
| `npm run dev` | Vite + Express via `concurrently` |
| `npm run build` | Production client build → `client/dist` |
| `npm run start` | One Node process: API + static assets when `NODE_ENV=production` |

---

## First-time configuration (self-hosted)

Sign-in uses **email one-time codes (OTP)**. The server must send mail, and you must list **admin email addresses** before those people sign in. The **admin** role is granted on **first** account creation for addresses in `RUMI_ADMIN_EMAILS`.

**Required inputs**

| Item | Role |
|------|------|
| **SMTP** | Outbound mail (`RUMI_SMTP_HOST`, `RUMI_SMTP_USER`, `RUMI_SMTP_PASS`, port, `RUMI_EMAIL_FROM`) |
| **Admin emails** | Comma-separated `RUMI_ADMIN_EMAILS`. First login with one of these addresses becomes an admin. |

**Optional**

| Item | Role |
|------|------|
| `RUMI_SUPERADMIN_EMAILS` | Approves public gallery submissions; if empty, admin list is used where relevant |
| `RUMI_AI_CONFIG_SECRET` | Encrypts the **stored** platform AI API key in the database (not your vendor key). Set in `.env`, or use **Generate and save** in initial setup or Admin Settings (written to `.env`; not displayed in the browser). |
| `BUILDER_DB_PATH` | SQLite file path (default `./data/builder.db`). The file and tables are **created when the server starts**, not by a separate installer. You can set or change this in **`/builder/setup`**; if you change it, **restart** the server so the app opens the new file. |

**How to configure**

1. **Start the server once** so SQLite is initialized (`initDb` runs on startup). You can open **`/builder/setup`** after that.
2. Edit `.env` and start the server, or follow [Deployment](#deployment).
3. If SMTP or admin emails are missing, open **`/builder/setup`**. On first boot the server emits a **setup token** (or set `RUMI_SETUP_TOKEN` / read `data/.setup_token`). The wizard merges values into `.env`, shows the current database path, and can write `BUILDER_DB_PATH` if you need a different file.

**Where the browser sends login requests (`VITE_AUTH_API_BASE`)**

| Scenario | Build-time variable | Typical value |
|----------|---------------------|---------------|
| Default (this app handles OTP) | *(omit)* | `/api/builder/auth` |
| Login served by another service on the same site | `VITE_AUTH_API_BASE` | Your nginx path to that service (example: `/api/auth-bridge`) |

If you use a separate login service, configure the **server** bridge (next section) and proxy both that service and `/api/builder/` to the right processes. The reference deploy in [`rumi_run_home`](https://github.com/rumi-run/rumi_run_home) uses `/api/auth-bridge` for the optional shared login stack.

---

## Optional external auth bridge (advanced)

**By default this is off.** Self-hosted installs normally rely only on **email OTP** from this repository.

Some deployments run a **separate** auth service on the same domain (cookie shared with the builder origin). The builder can then:

1. **Browser:** send sign-in requests to that service by setting `VITE_AUTH_API_BASE` to your reverse-proxy path (for example `/api/auth-bridge`).
2. **Server:** if you set **`BUILDER_AUTH_BRIDGE_INTERNAL_URL`** (internal base URL for that service, used only server-side) and **`BUILDER_AUTH_BRIDGE_COOKIE_NAME`** (session cookie name), the API and WebSocket layers will call `GET {internalUrl}/me` with the incoming `Cookie` header and map the returned user into the local SQLite user table.

If either bridge variable is empty, **no** call is made and only **`rumi_session`** (this app’s OTP session) is used.

**Deprecated but still read:** `RUMI_SSO_INTERNAL_URL`, `RUMI_SSO_COOKIE_NAME` (same meaning as the `BUILDER_AUTH_BRIDGE_*` variables).

If you upgraded from an older release that relied on **implicit** defaults for the bridge, set these two variables explicitly in the server `.env` (they are no longer hard-coded in the application).

---

## Environment variables

Copy [`.env.example`](./.env.example) to `.env` and adjust.

| Variable | Purpose |
|----------|---------|
| `BUILDER_PORT`, `BUILDER_HOST`, `BUILDER_DB_PATH` | HTTP bind address and SQLite file path |
| `NODE_ENV` | `production` enables stricter cookie and AI key handling |
| `RUMI_SMTP_*`, `RUMI_EMAIL_FROM` | Outbound mail for OTP |
| `RUMI_ADMIN_EMAILS`, `RUMI_SUPERADMIN_EMAILS` | Admin and super-admin email lists |
| `RUMI_AI_CONFIG_SECRET` | Key derivation for encrypting **stored** admin AI API keys |
| `RUMI_SETUP_TOKEN` | Optional fixed token for `/builder/setup` instead of `data/.setup_token` |
| `BUILDER_AUTH_BRIDGE_INTERNAL_URL`, `BUILDER_AUTH_BRIDGE_COOKIE_NAME` | Optional external auth bridge (see section above). Empty = disabled. |
| `RUMI_SSO_INTERNAL_URL`, `RUMI_SSO_COOKIE_NAME` | Deprecated aliases for the same bridge |

---

## AI configuration (administrators)

In **Admin Settings**, admins set **provider**, **API endpoint**, **API key**, **default model**, and usage limits (stored in `ai_config`). Code paths support **Anthropic-style** APIs (`anthropic`, `apimart`), **OpenAI** (`openai`), and **custom** URLs that accept a compatible JSON payload.

- **`RUMI_AI_CONFIG_SECRET`** encrypts the admin-supplied API key at rest. It is **not** the provider’s API key string itself. Generate it in the UI or set it in `.env`.
- In **production**, saving a non-empty API key generally requires `RUMI_AI_CONFIG_SECRET` so keys are not stored in plaintext.

---

## Repository layout

```
rumi-agent-builder/
├── client/
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── Auth/           # OTP login, initial setup
│       │   ├── Blocks/
│       │   ├── Canvas/
│       │   ├── Collaboration/
│       │   ├── Dashboard/
│       │   ├── Export/
│       │   ├── Layout/         # Shell, admin
│       │   └── Panels/
│       ├── hooks/
│       ├── stores/
│       ├── styles/
│       └── utils/
├── server/
│   ├── index.js
│   ├── db.js
│   ├── middleware.js
│   ├── ws.js
│   ├── config/settings.js
│   ├── routes/                 # auth, agents, sharing, orgs, comments, ai, admin, setup, communityTemplates
│   └── services/
├── package.json
└── .env.example
```

---

## Database (SQLite)

The app uses a **single SQLite file** (default `./data/builder.db`, overridable with `BUILDER_DB_PATH`). The parent directory is created if needed. **All tables are created automatically** when the server process runs `initDb()` on startup. There is no separate migration command for a normal install. The initial setup UI explains this and can persist an alternate `BUILDER_DB_PATH` to `.env` (restart required to switch files).

| Table | Purpose |
|-------|---------|
| `rumi_users` | Users (email, name, org, role) |
| `rumi_login_codes` | OTP challenges (hashed, expiring) |
| `rumi_sessions` | Sessions (30-day TTL) |
| `agent_builds` | Builds (`canvas_data` JSON, metadata, org, visibility) |
| `agent_build_versions` | Version history |
| `agent_shares` | Share links |
| `organizations` | Teams |
| `org_members` | Membership and invites |
| `block_comments` | Block comments |
| `active_presence` | Ephemeral WebSocket presence |
| `ai_config` | Platform AI settings |
| `ai_usage_logs` | AI usage |

---

## HTTP API overview

Base URL: **`/api/builder/`**. The tables summarize major routes; see `server/routes/` for every endpoint.

### Authentication (`/api/builder/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/request-code` | No | Send OTP |
| POST | `/verify-code` | No | Verify OTP, set session |
| GET | `/me` | Yes | Current user |
| GET | `/capabilities` | Yes | Admin / super-admin flags |
| POST | `/logout` | Yes | Sign out |
| PUT | `/profile` | Yes | Update profile |

### Agents (`/api/builder/agents`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List agents |
| GET | `/:id` | Yes | Get one |
| POST | `/` | Yes | Create |
| PUT | `/:id` | Yes | Update |
| DELETE | `/:id` | Yes | Delete |
| POST | `/:id/duplicate` | Yes | Duplicate |
| GET | `/:id/activity` | Yes | Activity |
| GET | `/:id/versions` | Yes | Versions |
| POST | `/:id/versions/:versionId/restore` | Yes | Restore version |
| GET | `/:id/access` | Yes | Access summary |

### Sharing (`/api/builder/sharing`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/:buildId/share` | Yes | Create link |
| GET | `/:buildId/shares` | Yes | List links |
| DELETE | `/revoke/:shareId` | Yes | Revoke |
| GET | `/shared/:token` | No | Open shared build |
| GET | `/shared-with-me` | Yes | Shared with me |

### Organizations (`/api/builder/orgs`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List orgs |
| POST | `/` | Yes | Create |
| GET | `/:orgId` | Yes | Detail |
| POST | `/:orgId/invite` | Yes | Invite |
| POST | `/:orgId/join` | Yes | Join |
| DELETE | `/:orgId/members/:userId` | Yes | Remove member |
| PUT | `/:orgId/members/:userId` | Yes | Change role |
| POST | `/:orgId/agents/:buildId` | Yes | Attach agent |
| GET | `/:orgId/agents` | Yes | List org agents |

### Comments (`/api/builder/comments`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/:buildId` | Yes | List |
| POST | `/:buildId` | Yes | Add |
| PUT | `/:commentId` | Yes | Edit |
| PUT | `/:commentId/resolve` | Yes | Resolve |
| DELETE | `/:commentId` | Yes | Delete |

### AI (`/api/builder/ai`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/generate-instructions` | Yes | Generate instructions |
| POST | `/validate-structure` | Yes | Validate structure |
| POST | `/suggest-blocks` | Yes | Suggest blocks |
| POST | `/generate-agent-intro` | Yes | Title / description |

### Community templates (`/api/builder/community-templates`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/public` | No | Public gallery |
| POST | `/submit` | Yes | Submit for review |
| GET | `/status/:buildId` | Yes | Status |

### Admin (`/api/builder/admin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/ai-config` | Admin | AI config |
| PUT | `/ai-config` | Admin | Update AI config |
| POST | `/generate-ai-config-secret` | Admin | Create `RUMI_AI_CONFIG_SECRET` in `.env` if unset |
| GET | `/users` | Admin | Users |
| GET | `/usage` | Admin | Usage |
| GET | `/template-submissions` | Super admin | Pending submissions |
| POST | `/template-submissions/:id/approve` | Super admin | Approve |
| POST | `/template-submissions/:id/reject` | Super admin | Reject |

### Initial setup (`/api/builder/setup`)

Active when SMTP or `RUMI_ADMIN_EMAILS` is incomplete. Requires setup token.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/status` | No | Setup state, `aiConfigSecretConfigured` |
| POST | `/apply` | Setup token | Write core `.env` fields |
| POST | `/generate-ai-secret` | Setup token | Append generated `RUMI_AI_CONFIG_SECRET` |

### WebSocket (`/ws/collab`)

Connect with `?buildId=<id>`. Cookie session required.

| Message | Flow | Role |
|---------|------|------|
| `presence`, `user_joined`, `user_left` | Server → client | Presence |
| `cursor_move`, `node_select` | Both | Focus |
| `canvas_update` | Both | Canvas |
| `comment_added` | Both | Comments |
| `ping` / `pong` | Both | Keep-alive |

---

## Block types (13)

| Type | Role |
|------|------|
| `llm` | Model and generation |
| `knowledge` | Sources |
| `instructions` | Persona and constraints |
| `tools` | Tools and APIs |
| `memory` | Retention patterns |
| `guardrails` | Safety and format |
| `input` | Triggers and inputs |
| `output` | Channels and formats |
| `variable` | Templates and KV |
| `condition` | Branching |
| `loop` | Iteration |
| `subagent` | Linked agents |
| `connector` | Handoffs and errors |

---

## Deployment

**Hosted (rumi.run):** Automated from [`rumi_run_home`](https://github.com/rumi-run/rumi_run_home) via `scripts/deploy_rumi_agent_builder.sh` (systemd, TLS, Nginx, remote build steps).

**Self-hosted**

1. Provide `.env` or finish `/builder/setup`.
2. `npm install` at repo root; `cd client && npm install && npm run build`.
3. `NODE_ENV=production npm run start` (or your process manager).
4. Terminate TLS upstream; reverse-proxy `/builder/`, `/api/builder/`, and `/ws/collab` to the app port.

### Nginx (example)

```nginx
location /builder/ {
    proxy_pass http://127.0.0.1:3020/builder/;
}

location /api/builder/ {
    proxy_pass http://127.0.0.1:3020/api/builder/;
}

location /ws/collab {
    proxy_pass http://127.0.0.1:3020/ws/collab;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;
}
```

### Example production `.env` (illustrative only)

```env
BUILDER_PORT=3020
BUILDER_HOST=0.0.0.0
BUILDER_DB_PATH=./data/builder.db
NODE_ENV=production
RUMI_SMTP_HOST=smtp.mail.me.com
RUMI_SMTP_PORT=587
RUMI_SMTP_USER=your-email@example.com
RUMI_SMTP_PASS=app-specific-password
RUMI_EMAIL_FROM=RUMI <noreply@rumi.run>
RUMI_ADMIN_EMAILS=admin@rumi.run,your@email.com
```

---

## Contributing

Issues and pull requests are welcome. Do not commit secrets: use `.env` locally.

Changes that touch the hosted deploy stack (scripts, nginx, optional shared auth) should be coordinated with [`rumi_run_home`](https://github.com/rumi-run/rumi_run_home).

---

## License

[MIT License](./LICENSE). Copyright (c) RUMI and contributors.

---

## Links

- **Product:** [rumi.run](https://rumi.run/)
- **Live app:** [rumi.run/builder](https://rumi.run/builder/)
- **Deploy host repo:** [rumi-run/rumi_run_home](https://github.com/rumi-run/rumi_run_home)
