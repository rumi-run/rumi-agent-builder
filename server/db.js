const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const settings = require('./config/settings');

const dbDir = path.dirname(path.resolve(settings.dbPath));
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new sqlite3.Database(path.resolve(settings.dbPath));

// Promisify
db.runAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

db.getAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

db.allAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

function initDb() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users
      db.run(`CREATE TABLE IF NOT EXISTS rumi_users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT DEFAULT '',
        avatar_url TEXT DEFAULT '',
        org TEXT DEFAULT '',
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now'))
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_rumi_users_email ON rumi_users(email)`);

      // Login codes
      db.run(`CREATE TABLE IF NOT EXISTS rumi_login_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT (datetime('now')),
        expires_at DATETIME NOT NULL,
        consumed_at DATETIME,
        ip TEXT,
        user_agent TEXT
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_rumi_codes_email ON rumi_login_codes(email)`);

      // Sessions
      db.run(`CREATE TABLE IF NOT EXISTS rumi_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT (datetime('now')),
        expires_at DATETIME NOT NULL,
        last_active_at DATETIME DEFAULT (datetime('now')),
        ip TEXT,
        user_agent TEXT,
        FOREIGN KEY (user_id) REFERENCES rumi_users(id)
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_rumi_sessions_email ON rumi_sessions(email)`);

      // Agent builds
      db.run(`CREATE TABLE IF NOT EXISTS agent_builds (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT DEFAULT 'Untitled Agent',
        description TEXT DEFAULT '',
        canvas_data TEXT DEFAULT '{}',
        tags TEXT DEFAULT '[]',
        status TEXT DEFAULT 'draft',
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES rumi_users(id)
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_agent_builds_user ON agent_builds(user_id)`);

      // Agent build versions
      db.run(`CREATE TABLE IF NOT EXISTS agent_build_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        build_id TEXT NOT NULL,
        version_num INTEGER NOT NULL,
        canvas_data TEXT NOT NULL,
        created_at DATETIME DEFAULT (datetime('now')),
        note TEXT DEFAULT '',
        FOREIGN KEY (build_id) REFERENCES agent_builds(id) ON DELETE CASCADE
      )`);

      // Agent sharing
      db.run(`CREATE TABLE IF NOT EXISTS agent_shares (
        id TEXT PRIMARY KEY,
        build_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        shared_with_email TEXT,
        share_token TEXT UNIQUE,
        permission TEXT DEFAULT 'view',
        created_at DATETIME DEFAULT (datetime('now')),
        expires_at DATETIME,
        FOREIGN KEY (build_id) REFERENCES agent_builds(id) ON DELETE CASCADE,
        FOREIGN KEY (owner_id) REFERENCES rumi_users(id)
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_agent_shares_build ON agent_shares(build_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_agent_shares_token ON agent_shares(share_token)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_agent_shares_email ON agent_shares(shared_with_email)`);

      // Organizations
      db.run(`CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        owner_id TEXT NOT NULL,
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now')),
        FOREIGN KEY (owner_id) REFERENCES rumi_users(id)
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_org_slug ON organizations(slug)`);

      // Organization members
      db.run(`CREATE TABLE IF NOT EXISTS org_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        org_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT DEFAULT 'member',
        invited_email TEXT,
        invited_at DATETIME DEFAULT (datetime('now')),
        joined_at DATETIME,
        FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES rumi_users(id)
      )`);

      db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_unique ON org_members(org_id, user_id)`);

      // Agent org visibility
      db.run(`ALTER TABLE agent_builds ADD COLUMN org_id TEXT DEFAULT NULL`, () => {});
      db.run(`ALTER TABLE agent_builds ADD COLUMN visibility TEXT DEFAULT 'private'`, () => {});

      // Block comments
      db.run(`CREATE TABLE IF NOT EXISTS block_comments (
        id TEXT PRIMARY KEY,
        build_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        resolved INTEGER DEFAULT 0,
        parent_id TEXT,
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now')),
        FOREIGN KEY (build_id) REFERENCES agent_builds(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES rumi_users(id)
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_block_comments_build ON block_comments(build_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_block_comments_node ON block_comments(build_id, node_id)`);

      // Presence tracking (ephemeral, cleaned on startup)
      db.run(`CREATE TABLE IF NOT EXISTS active_presence (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        build_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT DEFAULT '',
        user_email TEXT DEFAULT '',
        cursor_x REAL DEFAULT 0,
        cursor_y REAL DEFAULT 0,
        selected_node TEXT,
        last_seen DATETIME DEFAULT (datetime('now')),
        FOREIGN KEY (build_id) REFERENCES agent_builds(id) ON DELETE CASCADE
      )`);

      db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_presence_unique ON active_presence(build_id, user_id)`);

      // Clean stale presence on startup
      db.run(`DELETE FROM active_presence`);

      // Activity log for collaboration audit trail
      db.run(`CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        build_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT (datetime('now')),
        FOREIGN KEY (build_id) REFERENCES agent_builds(id) ON DELETE CASCADE
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_activity_log_build ON activity_log(build_id)`);

      // Add version author tracking columns
      db.run(`ALTER TABLE agent_build_versions ADD COLUMN user_id TEXT DEFAULT ''`, () => {});
      db.run(`ALTER TABLE agent_build_versions ADD COLUMN user_email TEXT DEFAULT ''`, () => {});

      // Performance indexes for frequently queried columns
      db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON rumi_sessions(expires_at)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_builds_visibility ON agent_builds(visibility)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_builds_org ON agent_builds(org_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_shares_expires ON agent_shares(expires_at)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at)`);

      // Clean expired login codes (older than 1 hour)
      db.run(`DELETE FROM rumi_login_codes WHERE expires_at < datetime('now', '-1 hour')`);

      // Clean expired sessions
      db.run(`DELETE FROM rumi_sessions WHERE expires_at < datetime('now')`);

      // AI config (admin-managed)
      db.run(`CREATE TABLE IF NOT EXISTS ai_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        api_provider TEXT DEFAULT 'apimart',
        api_endpoint TEXT DEFAULT '',
        api_key_encrypted TEXT DEFAULT '',
        default_model TEXT DEFAULT 'claude-opus-4-6',
        rate_limit_per_user INTEGER DEFAULT 50,
        rate_limit_window TEXT DEFAULT 'day',
        enabled INTEGER DEFAULT 1,
        updated_at DATETIME DEFAULT (datetime('now'))
      )`);

      // AI usage logs
      db.run(`CREATE TABLE IF NOT EXISTS ai_usage_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        tokens_used INTEGER DEFAULT 0,
        model TEXT DEFAULT '',
        created_at DATETIME DEFAULT (datetime('now'))
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage_logs(user_id)`);

      // Community template submissions (require super admin approval)
      db.run(`CREATE TABLE IF NOT EXISTS template_submissions (
        id TEXT PRIMARY KEY,
        build_id TEXT NOT NULL,
        submitter_user_id TEXT NOT NULL,
        proposed_name TEXT NOT NULL,
        proposed_description TEXT DEFAULT '',
        proposed_category TEXT DEFAULT 'enterprise',
        proposed_icon TEXT DEFAULT '📋',
        canvas_snapshot TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        reviewer_user_id TEXT,
        reviewed_at DATETIME,
        rejection_reason TEXT,
        published_public_id TEXT,
        created_at DATETIME DEFAULT (datetime('now')),
        FOREIGN KEY (build_id) REFERENCES agent_builds(id) ON DELETE CASCADE,
        FOREIGN KEY (submitter_user_id) REFERENCES rumi_users(id)
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_template_sub_build ON template_submissions(build_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_template_sub_status ON template_submissions(status)`);

      db.run(`CREATE TABLE IF NOT EXISTS published_system_templates (
        id TEXT PRIMARY KEY,
        submission_id TEXT,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        category TEXT DEFAULT 'enterprise',
        icon TEXT DEFAULT '📋',
        canvas_data TEXT NOT NULL,
        source_build_id TEXT,
        submitted_by_user_id TEXT,
        approved_by_user_id TEXT,
        created_at DATETIME DEFAULT (datetime('now')),
        FOREIGN KEY (submission_id) REFERENCES template_submissions(id)
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_pub_templates_slug ON published_system_templates(slug)`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

module.exports = { db, initDb };
