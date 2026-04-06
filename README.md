# RUMI Agent Builder

Visual drag-and-drop AI agent planning platform at **rumi.run/builder**.

Open source under the **MIT License** (see `LICENSE`). Source: **https://github.com/rumi-run/rumi-agent-builder**

## Quick Start

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Configure environment
cp .env.example .env
# Edit .env with your SMTP credentials and admin emails

# Development (client + server)
npm run dev
# Client: http://localhost:5173/builder/
# Server: http://localhost:3020/api/builder/health
```

## Architecture

```
rumi-agent-builder/
├── client/                     # React + Vite + Tailwind
│   └── src/
│       ├── App.jsx             # Router (login, dashboard, canvas, org, admin, shared)
│       ├── components/
│       │   ├── Auth/           # LoginPage (OTP email flow)
│       │   ├── Blocks/         # AgentBlockNode (React Flow node)
│       │   ├── Canvas/         # CanvasPage, CanvasToolbar, CustomEdge, KeyboardShortcuts
│       │   ├── Collaboration/  # ShareModal, CommentsPanel, OrgPage, OrgSidebar,
│       │   │                   # CollaboratorCursors, SharedView
│       │   ├── Dashboard/      # Dashboard, TemplatesGallery
│       │   ├── Export/         # ExportModal, PresentationMode
│       │   ├── Layout/         # AppLayout, AdminPanel
│       │   └── Panels/         # BlockPalette, DetailPanel, AiWriter
│       ├── hooks/
│       │   └── useCollaboration.js  # WebSocket hook for real-time collab
│       ├── stores/
│       │   ├── authStore.js    # Zustand auth state
│       │   └── canvasStore.js  # Zustand canvas state (nodes, edges, undo/redo)
│       ├── styles/
│       │   └── index.css       # Tailwind + custom RUMI design tokens
│       └── utils/
│           ├── api.js          # REST client (auth, agents, sharing, orgs, comments, ai, admin)
│           ├── blockTypes.js   # 13 block type definitions
│           └── templates.js    # Agent template presets
│
├── server/                     # Express.js + SQLite
│   ├── index.js                # App entry, route mounting, HTTP + WebSocket server
│   ├── db.js                   # SQLite schema + migrations (11 tables)
│   ├── middleware.js            # requireAuth, requireAdmin
│   ├── ws.js                   # WebSocket server for real-time collaboration
│   ├── config/
│   │   └── settings.js         # Port, SMTP, auth, AI defaults from env
│   ├── routes/
│   │   ├── auth.js             # POST request-code, verify-code, GET me, POST logout
│   │   ├── agents.js           # CRUD + duplicate (owner, org, share access)
│   │   ├── sharing.js          # Share links (create, list, revoke, access)
│   │   ├── orgs.js             # Orgs (create, invite, join, members, agents)
│   │   ├── comments.js         # Block comments (CRUD, resolve, threads)
│   │   ├── ai.js               # AI generate, validate, suggest
│   │   └── admin.js            # AI config, users, usage stats
│   └── services/
│       ├── authService.js      # OTP, sessions, user management
│       └── emailService.js     # Nodemailer SMTP for OTP delivery
│
├── package.json                # Server deps (express, sqlite3, ws, etc.)
└── .env.example                # Environment variable template
```

## Database Schema (SQLite)

| Table | Purpose |
|-------|---------|
| `rumi_users` | Users (email, name, org, role) |
| `rumi_login_codes` | OTP codes (hashed, with expiry) |
| `rumi_sessions` | Active sessions (30-day TTL) |
| `agent_builds` | Agent builds (canvas_data JSON, tags, status, org_id, visibility) |
| `agent_build_versions` | Version history (build_id, version_num, canvas_data) |
| `agent_shares` | Share links (token, permission, email, expiry) |
| `organizations` | Teams (name, slug, owner_id) |
| `org_members` | Org membership (role: owner/admin/member, invites) |
| `block_comments` | Comments on blocks (threads, resolve state) |
| `active_presence` | Ephemeral WebSocket presence (cleaned on startup) |
| `ai_config` | Admin AI provider config (single row) |
| `ai_usage_logs` | AI request tracking (user, tokens, model) |

## API Endpoints

### Authentication (`/api/builder/auth`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/request-code` | No | Send OTP to email |
| POST | `/verify-code` | No | Verify OTP, create session |
| GET | `/me` | Yes | Get current user |
| POST | `/logout` | Yes | Destroy session |
| PUT | `/profile` | Yes | Update name/org |

### Agents (`/api/builder/agents`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List my agents |
| GET | `/:id` | Yes | Get agent (owner/shared/org) |
| POST | `/` | Yes | Create agent |
| PUT | `/:id` | Yes | Update agent |
| DELETE | `/:id` | Yes | Delete agent |
| POST | `/:id/duplicate` | Yes | Clone agent |

### Sharing (`/api/builder/sharing`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/:buildId/share` | Yes | Create share link |
| GET | `/:buildId/shares` | Yes | List shares for agent |
| DELETE | `/revoke/:shareId` | Yes | Revoke a share |
| GET | `/shared/:token` | No | Access shared agent |
| GET | `/shared-with-me` | Yes | List agents shared with me |

### Organizations (`/api/builder/orgs`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List my orgs |
| POST | `/` | Yes | Create org |
| GET | `/:orgId` | Yes | Get org + members |
| POST | `/:orgId/invite` | Yes | Invite member (admin+) |
| POST | `/:orgId/join` | Yes | Accept invite |
| DELETE | `/:orgId/members/:userId` | Yes | Remove member (admin+) |
| PUT | `/:orgId/members/:userId` | Yes | Change role (owner only) |
| POST | `/:orgId/agents/:buildId` | Yes | Move agent to org |
| GET | `/:orgId/agents` | Yes | List org agents |

### Comments (`/api/builder/comments`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/:buildId` | Yes | List comments |
| POST | `/:buildId` | Yes | Add comment |
| PUT | `/:commentId` | Yes | Edit comment |
| PUT | `/:commentId/resolve` | Yes | Resolve/unresolve |
| DELETE | `/:commentId` | Yes | Delete comment |

### AI (`/api/builder/ai`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/generate-instructions` | Yes | AI-generate instructions |
| POST | `/validate-structure` | Yes | Validate agent structure |
| POST | `/suggest-blocks` | Yes | Suggest missing blocks |

### Admin (`/api/builder/admin`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/ai-config` | Admin | Get AI config |
| PUT | `/ai-config` | Admin | Update AI config |
| GET | `/users` | Admin | List all users |
| GET | `/usage` | Admin | Platform usage stats |

### WebSocket (`/ws/collab`)
Connect with `?buildId=<id>`. Cookie-based auth.

| Message Type | Direction | Payload |
|-------------|-----------|---------|
| `presence` | Server->Client | `{ users: [...] }` |
| `user_joined` | Server->Client | `{ user: { userId, userName } }` |
| `user_left` | Server->Client | `{ user: { userId, userName } }` |
| `cursor_move` | Bidirectional | `{ x, y }` |
| `node_select` | Bidirectional | `{ nodeId }` |
| `canvas_update` | Bidirectional | `{ action, payload }` |
| `comment_added` | Bidirectional | `{ comment }` |
| `ping`/`pong` | Bidirectional | Keep-alive |

## Block Types

| Type | Icon | Fields |
|------|------|--------|
| `llm` | Brain | provider, model, temperature, maxTokens |
| `knowledge` | Book | sourceType (files/URLs/DB/API), sources list |
| `instructions` | Note | persona, instructions, tone, constraints |
| `tools` | Wrench | tool names, API endpoints, descriptions |
| `memory` | Disk | type (conversation/summary/vector/kv), windowSize |
| `guardrails` | Shield | safety rules, blocked topics, output format |
| `input` | Inbox | type (chat/API/webhook/email/scheduled/file) |
| `output` | Outbox | type, format (text/JSON/markdown/HTML) |
| `variable` | Pin | key-value pairs, templates |
| `condition` | Router | condition statements, default route |
| `loop` | Loop | type (forEach/while/retry/batch), maxIterations |
| `subagent` | Robot | linked agent name/ID |
| `connector` | Link | handoff rules, data passthrough, error handling |

## Deployment

Automated production deploy for rumi.run is scripted from the hosting [`rumi_run_home`](https://github.com/rumi-run/rumi_run_home) repository: `scripts/deploy_rumi_agent_builder.sh`.

For manual self-hosting: configure `.env`, run `npm install`, build the client with `npm run build`, then start the server with `npm run start` (see `.env.example` and Nginx notes below).

### Nginx config (add WebSocket support)

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

### Server .env (on production host)

```env
BUILDER_PORT=3020
BUILDER_HOST=0.0.0.0
BUILDER_DB_PATH=./data/builder.db
NODE_ENV=production
RUMI_SMTP_HOST=smtp.mail.me.com
RUMI_SMTP_PORT=587
RUMI_SMTP_USER=your-icloud@icloud.com
RUMI_SMTP_PASS=app-specific-password
RUMI_EMAIL_FROM=RUMI <noreply@rumi.run>
RUMI_ADMIN_EMAILS=admin@rumi.run,your@email.com
```

## Feature Roadmap

### Completed
- [x] OTP email auth with 30-day sessions
- [x] Agent builder with 13 block types, drag-and-drop canvas
- [x] Undo/redo, auto-save (30s), keyboard shortcuts
- [x] Export to HTML (printable) and JSON
- [x] Presentation mode (slideshow)
- [x] AI-assisted instruction writing (generate/improve)
- [x] AI structure validation and block suggestions
- [x] Admin panel (AI config, user management, usage stats)
- [x] Agent templates gallery
- [x] Agent sharing (link-based, email-targeted, view/edit)
- [x] Organization/team management
- [x] Real-time collaboration (WebSocket presence, cursors, selections)
- [x] Block commenting/annotation system

### Next Up
- [ ] API key encryption (encrypt at rest, decrypt on use)
- [ ] Rate limiting enforcement (config exists, not enforced)
- [ ] Build version history UI (DB table exists)
- [ ] Canvas JSON import (export works, no import)
- [ ] Sub-agent linking/resolution
- [ ] Agent deployment targets
- [ ] File upload for Knowledge blocks
- [ ] Agent execution runtime
