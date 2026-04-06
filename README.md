# RUMI Agent Builder

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Live app](https://img.shields.io/badge/Live-rumi.run%2Fbuilder-6366f1.svg)](https://rumi.run/builder/)
[![RUMI](https://img.shields.io/badge/RUMI-rumi.run-111827.svg)](https://rumi.run/)

**Design, document, and collaborate on AI agents before you ship them.** RUMI Agent Builder is a browser-based workspace where teams map **LLMs, tools, memory, guardrails, and handoffs** on a visual canvas. It pairs product thinking with engineering detail: templates, version-friendly data in SQLite, and real-time presence so reviews feel like a shared studio, not a static diagram.

**Official instance:** [rumi.run/builder](https://rumi.run/builder/) · **License:** [MIT](./LICENSE) · **Source:** this repository

---

## Why this project exists

- **Clarity before code.** Agent systems get complex fast. A structured canvas turns intent into inspectable blocks: inputs, outputs, policies, and connectors you can walk through with stakeholders.
- **Built for teams.** Share links, organizations, block-level comments, and live cursors turn the canvas into a collaboration surface, not a solo scratchpad.
- **Grounded in shipping practice.** OTP email auth, admin tooling, AI-assisted drafting, export (HTML / JSON), and presentation mode support real workflows from first sketch to review.

---

## Highlights

| Area | What you get |
|------|----------------|
| **Canvas** | Drag-and-drop graph, 13 agent block types, undo/redo, auto-save, keyboard shortcuts |
| **AI assist** | Generate or refine instructions, validate structure, suggest blocks, agent intro copy (admin-configured provider and model) |
| **Collaboration** | WebSocket presence, cursors, shared canvas updates, comments on blocks |
| **Access control** | Email OTP sessions, share links (view/edit), organization membership and invites |
| **Export** | Printable HTML, JSON, presentation mode for walkthroughs |
| **Operations** | Express API, SQLite persistence, health endpoint, optional SSO alignment via hosting setup |
| **Admin** | AI provider settings, user list, usage, optional community template approvals (super admin) |
| **Self-hosted setup** | Initial wizard at `/builder/setup` for SMTP, admin emails, optional encryption secret (writes `.env`) |

---

## Architecture at a glance

- **Client:** React, Vite, Tailwind, React Flow-style canvas, Zustand stores, collaboration hooks.
- **Server:** Node.js, Express, SQLite (schema + migrations), WebSocket server for real-time sessions.
- **Auth:** Email OTP and cookie sessions. The same codebase can use **builder-local auth** (`/api/builder/auth`) or, on the hosted stack, a reverse proxy to **unified auth** (`VITE_AUTH_API_BASE=/api/rumi-auth` at build time).

For a full file tree, see **Repository layout** below.

---

## Quick start

```bash
git clone https://github.com/rumi-run/rumi-agent-builder.git
cd rumi-agent-builder

npm install
cd client && npm install && cd ..

cp .env.example .env
# Edit .env, or use the in-app wizard (see First-time configuration).

npm run dev
```

| URL | Purpose |
|-----|---------|
| `http://localhost:5173/builder/` | Client (Vite dev server; proxies `/api/builder` to the app) |
| `http://localhost:3020/api/builder/health` | API health |

**Scripts**

| Command | Description |
|---------|-------------|
| `npm run dev` | Runs Vite and Express together (`concurrently`) |
| `npm run build` | Builds the client to `client/dist` |
| `npm run start` | Single Node process: API + static files from `client/dist` when `NODE_ENV=production` |

---

## First-time configuration (self-hosted)

Sign-in is **email one-time password (OTP)**. The server must send mail, and you must declare which addresses are **admins** before those users sign in (role is assigned on first account creation).

**What you need**

| Item | Why |
|------|-----|
| **SMTP** | Delivers OTP messages (`RUMI_SMTP_HOST`, `RUMI_SMTP_USER`, `RUMI_SMTP_PASS`, port, `RUMI_EMAIL_FROM`) |
| **Admin emails** | Comma-separated list (`RUMI_ADMIN_EMAILS`). The first login using one of these addresses gets the **admin** role. |
| **Optional** | `RUMI_SUPERADMIN_EMAILS` (template approvals; defaults to admin list if empty). `RUMI_AI_CONFIG_SECRET` encrypts the **stored** admin AI API key in the database. Paste a value in `.env`, or use **Generate and save** in initial setup or Admin Settings (writes `.env`; the secret is not shown in the browser). |

**Ways to configure**

1. **Edit `.env`** before or after deploy, then start the server (see [Deployment](#deployment)).
2. **Initial setup UI** when SMTP or admin emails are missing: open **`/builder/setup`**. The server prints a **one-time setup token** on first start (or use `RUMI_SETUP_TOKEN` / `data/.setup_token`). The form merges values into **`.env`** and reloads settings in the running process.

**Client auth base URL**

| Deployment | Build-time variable | Typical value |
|------------|--------------------|---------------|
| Standalone (this repo + Express) | Default | `/api/builder/auth` |
| Hosted RUMI stack (unified auth) | `VITE_AUTH_API_BASE` | `/api/rumi-auth` |

The [deploy script](https://github.com/rumi-run/rumi_run_home) in `rumi_run_home` sets `VITE_AUTH_API_BASE=/api/rumi-auth` when building for production.

---

## Environment variables

Copy [`.env.example`](./.env.example) to `.env` and adjust. Common keys:

| Variable | Purpose |
|----------|---------|
| `BUILDER_PORT`, `BUILDER_HOST`, `BUILDER_DB_PATH` | HTTP bind and SQLite path |
| `NODE_ENV` | `production` enables secure cookies and stricter AI key rules |
| `RUMI_SMTP_*`, `RUMI_EMAIL_FROM` | Outbound mail for OTP |
| `RUMI_ADMIN_EMAILS`, `RUMI_SUPERADMIN_EMAILS` | Admin and super-admin email lists |
| `RUMI_AI_CONFIG_SECRET` | Derives encryption key for **stored** AI API keys (not the provider key itself) |
| `RUMI_SETUP_TOKEN` | Optional fixed token for `/builder/setup` instead of `data/.setup_token` |
| `RUMI_SSO_INTERNAL_URL`, `RUMI_SSO_COOKIE_NAME` | Optional alignment with rumi-unified-auth when deployed behind the same stack |

---

## AI configuration (admin)

Admins configure **provider**, **API endpoint**, **API key**, **default model**, and rate limits in **Admin Settings** (backed by the `ai_config` table). Supported provider modes in code include **Anthropic-style** (`anthropic`, `apimart`), **OpenAI** (`openai`), and **custom** endpoints with a compatible JSON body.

- **`RUMI_AI_CONFIG_SECRET`:** Used only to encrypt the admin-supplied API key at rest. It is **not** your model vendor secret. Generate it in Admin Settings or initial setup, or set it manually in `.env`.
- **Production:** Saving a non-empty API key typically requires `RUMI_AI_CONFIG_SECRET` to be set so keys are not stored in plaintext.

---

## Repository layout

```
rumi-agent-builder/
├── client/                     # React + Vite + Tailwind
│   └── src/
│       ├── App.jsx             # Routes (login, setup, dashboard, canvas, org, admin, shared)
│       ├── components/
│       │   ├── Auth/           # Login (OTP), initial setup wizard
│       │   ├── Blocks/         # Agent block nodes
│       │   ├── Canvas/         # Canvas, toolbar, edges, shortcuts
│       │   ├── Collaboration/  # Sharing, orgs, presence, comments, shared view
│       │   ├── Dashboard/      # Dashboard, templates
│       │   ├── Export/         # Export + presentation mode
│       │   ├── Layout/         # App shell, admin
│       │   └── Panels/         # Palette, detail, AI writer
│       ├── hooks/              # Collaboration WebSocket hook
│       ├── stores/             # Zustand (auth, canvas)
│       ├── styles/
│       └── utils/              # API client, block types, templates
├── server/                     # Express + SQLite + WebSocket
│   ├── index.js                # HTTP + WS entry
│   ├── db.js                   # Schema and migrations
│   ├── middleware.js           # Auth guards
│   ├── ws.js                   # Real-time collaboration
│   ├── config/settings.js
│   ├── routes/                 # auth, agents, sharing, orgs, comments, ai, admin, setup, communityTemplates
│   └── services/               # Auth, email (SMTP), setup (.env merge)
├── package.json
└── .env.example
```

---

## Database (SQLite)

| Table | Purpose |
|-------|---------|
| `rumi_users` | Users (email, name, org, role) |
| `rumi_login_codes` | OTP codes (hashed, with expiry) |
| `rumi_sessions` | Active sessions (30-day TTL) |
| `agent_builds` | Agent builds (`canvas_data` JSON, tags, status, org, visibility) |
| `agent_build_versions` | Version history |
| `agent_shares` | Share links (token, permission, email, expiry) |
| `organizations` | Teams |
| `org_members` | Membership and invites |
| `block_comments` | Block comments and threads |
| `active_presence` | Ephemeral WebSocket presence |
| `ai_config` | Admin AI provider configuration |
| `ai_usage_logs` | AI request usage |

---

## HTTP API overview

Base path: **`/api/builder/`**. The tables below list representative routes; see `server/routes/` for the full set.

### Authentication (`/api/builder/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/request-code` | No | Send OTP to email |
| POST | `/verify-code` | No | Verify OTP, create session |
| GET | `/me` | Yes | Current user |
| GET | `/capabilities` | Yes | Admin / super-admin flags for the UI |
| POST | `/logout` | Yes | End session |
| PUT | `/profile` | Yes | Update profile |

### Agents (`/api/builder/agents`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List my agents |
| GET | `/:id` | Yes | Get one agent |
| POST | `/` | Yes | Create |
| PUT | `/:id` | Yes | Update |
| DELETE | `/:id` | Yes | Delete |
| POST | `/:id/duplicate` | Yes | Duplicate |
| GET | `/:id/activity` | Yes | Activity log |
| GET | `/:id/versions` | Yes | Version list |
| POST | `/:id/versions/:versionId/restore` | Yes | Restore version |
| GET | `/:id/access` | Yes | Access summary |

### Sharing (`/api/builder/sharing`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/:buildId/share` | Yes | Create share link |
| GET | `/:buildId/shares` | Yes | List shares |
| DELETE | `/revoke/:shareId` | Yes | Revoke |
| GET | `/shared/:token` | No | Open shared agent |
| GET | `/shared-with-me` | Yes | Shared with me |

### Organizations (`/api/builder/orgs`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List orgs |
| POST | `/` | Yes | Create org |
| GET | `/:orgId` | Yes | Org detail |
| POST | `/:orgId/invite` | Yes | Invite |
| POST | `/:orgId/join` | Yes | Accept invite |
| DELETE | `/:orgId/members/:userId` | Yes | Remove member |
| PUT | `/:orgId/members/:userId` | Yes | Change role |
| POST | `/:orgId/agents/:buildId` | Yes | Attach agent to org |
| GET | `/:orgId/agents` | Yes | List org agents |

### Comments (`/api/builder/comments`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/:buildId` | Yes | List comments |
| POST | `/:buildId` | Yes | Add |
| PUT | `/:commentId` | Yes | Edit |
| PUT | `/:commentId/resolve` | Yes | Resolve |
| DELETE | `/:commentId` | Yes | Delete |

### AI (`/api/builder/ai`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/generate-instructions` | Yes | Generate instructions |
| POST | `/validate-structure` | Yes | Validate agent structure |
| POST | `/suggest-blocks` | Yes | Suggest blocks |
| POST | `/generate-agent-intro` | Yes | Generate title / description for an agent |

### Community templates (`/api/builder/community-templates`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/public` | No | Public gallery entries |
| POST | `/submit` | Yes | Submit a build for gallery review |
| GET | `/status/:buildId` | Yes | Submission status for a build |

### Admin (`/api/builder/admin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/ai-config` | Admin | AI config (includes whether `RUMI_AI_CONFIG_SECRET` is set) |
| PUT | `/ai-config` | Admin | Update AI config |
| POST | `/generate-ai-config-secret` | Admin | Generate `RUMI_AI_CONFIG_SECRET` and write `.env` if not already set |
| GET | `/users` | Admin | Users (paginated) |
| GET | `/usage` | Admin | Usage stats |
| GET | `/template-submissions` | Super admin | Pending template submissions |
| POST | `/template-submissions/:id/approve` | Super admin | Approve submission |
| POST | `/template-submissions/:id/reject` | Super admin | Reject submission |

### Initial setup (`/api/builder/setup`)

Used when SMTP or `RUMI_ADMIN_EMAILS` is not yet configured. Persists to `.env` and requires a setup token (server log, `data/.setup_token`, or `RUMI_SETUP_TOKEN`).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/status` | No | Whether core setup is required; includes `aiConfigSecretConfigured` |
| POST | `/apply` | Setup token | Write SMTP, admin emails, optional AI secret |
| POST | `/generate-ai-secret` | Setup token | Generate `RUMI_AI_CONFIG_SECRET` and append to `.env` |

### WebSocket (`/ws/collab`)

Connect with `?buildId=<id>`. Cookie-based auth.

| Message | Direction | Role |
|---------|-----------|------|
| `presence`, `user_joined`, `user_left` | Server → client | Who is online |
| `cursor_move`, `node_select` | Both | Presence and focus |
| `canvas_update` | Both | Canvas sync |
| `comment_added` | Both | Comment sync |
| `ping` / `pong` | Both | Keep-alive |

---

## Block types (13)

| Type | Role |
|------|------|
| `llm` | Model and generation parameters |
| `knowledge` | Files, URLs, DB, API sources |
| `instructions` | Persona, tone, constraints |
| `tools` | Tools and endpoints |
| `memory` | Conversation, summary, vector, KV |
| `guardrails` | Safety and format rules |
| `input` | Chat, API, webhook, email, schedule, file |
| `output` | Channel and format |
| `variable` | Key-value and templates |
| `condition` | Branching logic |
| `loop` | Iteration and retries |
| `subagent` | Linked agent |
| `connector` | Handoff and error handling |

---

## Deployment

**Hosted RUMI stack:** production deploy for rumi.run is automated from [`rumi_run_home`](https://github.com/rumi-run/rumi_run_home) using `scripts/deploy_rumi_agent_builder.sh` (systemd, Nginx, and server-side build steps live there).

**Self-hosted**

1. Configure `.env` (or complete `/builder/setup`).
2. `npm install` at the repo root; `cd client && npm install && npm run build`.
3. `NODE_ENV=production npm run start` from the repo root (or use a process manager).
4. Terminate TLS and reverse-proxy `/builder/`, `/api/builder/`, and `/ws/collab` to the Node port.

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

### Example production `.env` (illustrative)

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

Issues and pull requests are welcome. Keep security-sensitive values out of Git: use `.env` locally and never commit secrets.

For changes that also affect the hosted RUMI monorepo (deploy scripts, SSO snippets), coordinate with [`rumi_run_home`](https://github.com/rumi-run/rumi_run_home).

---

## License

[MIT License](./LICENSE). Copyright (c) RUMI and contributors.

---

## Links

- **Product:** [rumi.run](https://rumi.run/)
- **Live builder:** [rumi.run/builder](https://rumi.run/builder/)
- **Host monorepo (deploy):** [rumi-run/rumi_run_home](https://github.com/rumi-run/rumi_run_home)
