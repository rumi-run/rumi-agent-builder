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
| **AI assist** | Generate or refine instructions, validate structure, suggest missing blocks (admin-configured provider) |
| **Collaboration** | WebSocket presence, cursors, shared canvas updates, comments on blocks |
| **Access control** | Email OTP sessions, share links (view/edit), organization membership and invites |
| **Export** | Printable HTML, JSON, presentation mode for walkthroughs |
| **Operations** | Express API, SQLite persistence, health endpoint, optional SSO alignment via hosting setup |

---

## Architecture at a glance

- **Client:** React, Vite, Tailwind, React Flow-style canvas, Zustand stores, collaboration hooks.
- **Server:** Node.js, Express, SQLite (schema + migrations), WebSocket server for real-time sessions.
- **Auth:** Email OTP and cookie sessions; production stacks often pair with the broader RUMI SSO and reverse proxy rules documented in the host repo.

For a full file tree and module map, see **Repository layout** below.

---

## Quick start

```bash
git clone https://github.com/rumi-run/rumi-agent-builder.git
cd rumi-agent-builder

npm install
cd client && npm install && cd ..

cp .env.example .env
# Edit .env, or use the in-app wizard (see "First-time configuration" below).

npm run dev
```

- **Client (dev):** `http://localhost:5173/builder/`
- **API health:** `http://localhost:3020/api/builder/health`

Use `npm run start` after a production build for a single Node process serving the app per your `.env`.

---

## First-time configuration (self-hosted)

Sign-in is **email one-time password (OTP)**. The server must send mail, and you must declare which addresses are **admins** before those users sign in (role is assigned on first account creation).

**What you need**

| Item | Why |
|------|-----|
| **SMTP** | Delivers OTP messages (`RUMI_SMTP_HOST`, `RUMI_SMTP_USER`, `RUMI_SMTP_PASS`, port, `RUMI_EMAIL_FROM`) |
| **Admin emails** | Comma-separated list (`RUMI_ADMIN_EMAILS`). The first login using one of these addresses gets the **admin** role. |
| **Optional** | `RUMI_SUPERADMIN_EMAILS` (template approvals; defaults to admin list if empty), `RUMI_AI_CONFIG_SECRET` (encrypts admin AI API keys at rest in production) |

**Two ways to configure**

1. **Edit `.env`** before or after deploy, then start the server (see example block under [Deployment](#deployment)).
2. **In-app initial setup** (when SMTP or admin emails are still missing): open **`/builder/setup`**. The server prints a **one-time setup token** on first start (or use `RUMI_SETUP_TOKEN` / the contents of `data/.setup_token`). The form saves values into the project **`.env`** file and applies them in the running process so you can continue to sign in without an extra restart in most cases.

Hosted **rumi.run** builds the client with unified auth (`VITE_AUTH_API_BASE=/api/rumi-auth`). For a **standalone** clone, the default client points at **`/api/builder/auth`** on the same host, which matches this repository’s Express routes.

---

## Repository layout

```
rumi-agent-builder/
├── client/                     # React + Vite + Tailwind
│   └── src/
│       ├── App.jsx             # Routes (login, dashboard, canvas, org, admin, shared)
│       ├── components/
│       │   ├── Auth/           # Login (email OTP)
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
│   ├── routes/                 # auth, agents, sharing, orgs, comments, ai, admin
│   └── services/               # Auth, email (SMTP)
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

Base paths are mounted under `/api/builder/` in a typical deployment. Representative routes:

### Authentication (`/api/builder/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/request-code` | No | Send OTP to email |
| POST | `/verify-code` | No | Verify OTP, create session |
| GET | `/me` | Yes | Current user |
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

### Admin (`/api/builder/admin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/ai-config` | Admin | AI config |
| PUT | `/ai-config` | Admin | Update AI config |
| GET | `/users` | Admin | Users |
| GET | `/usage` | Admin | Usage stats |

### Initial setup (`/api/builder/setup`)

Used when SMTP or `RUMI_ADMIN_EMAILS` is not yet configured. Saves to the server `.env` and requires a setup token (server log, `data/.setup_token`, or `RUMI_SETUP_TOKEN`).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/status` | No | Whether core setup is still required |
| POST | `/apply` | Setup token (`X-Setup-Token` or `token` in JSON) | Write SMTP, admin emails, optional AI secret |

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

**Self-hosted:** set `.env`, install dependencies, run `npm run build` for the client, then `npm run start` from the project root. Use a process manager and TLS in front of the app in production.

### Nginx (WebSocket example)

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

## Roadmap

### Shipped in tree

- OTP email auth and long-lived sessions
- Initial setup UI at `/builder/setup` (SMTP + admin emails, optional AI secret) with `.env` persistence
- Admin AI API keys encrypted at rest when `RUMI_AI_CONFIG_SECRET` is set
- Full canvas with 13 block types, undo/redo, auto-save, shortcuts
- Export to HTML and JSON, presentation mode
- AI drafting, validation, and block suggestions (admin-configured)
- Admin: AI config, users, usage
- Templates gallery, sharing, organizations
- Real-time collaboration and block comments

### Next up

- Enforced rate limits
- Version history UI (data model exists)
- Canvas JSON import
- Deeper sub-agent linking
- Agent deployment targets
- Knowledge block file upload
- Agent execution runtime

---

## Contributing

Issues and pull requests are welcome. Please keep security-sensitive values out of Git; use `.env` locally and never commit secrets.

For changes that also affect the hosted RUMI monorepo (deploy scripts, SSO snippets), coordinate with [`rumi_run_home`](https://github.com/rumi-run/rumi_run_home).

---

## License

[MIT License](./LICENSE). Copyright (c) RUMI and contributors.

---

## Links

- **Product:** [rumi.run](https://rumi.run/)
- **Live builder:** [rumi.run/builder](https://rumi.run/builder/)
- **Host monorepo (deploy):** [rumi-run/rumi_run_home](https://github.com/rumi-run/rumi_run_home)
