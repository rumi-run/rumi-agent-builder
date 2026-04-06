const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const settings = require('../config/settings');
const { resetTransporter } = require('./emailService');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const SETUP_TOKEN_FILE = path.join(DATA_DIR, '.setup_token');

function parseAdminList(str) {
  return String(str || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function computeNeedsSetup() {
  const host = (process.env.RUMI_SMTP_HOST || '').trim();
  const user = (process.env.RUMI_SMTP_USER || '').trim();
  const admins = parseAdminList(process.env.RUMI_ADMIN_EMAILS);
  const smtpOk = host.length > 0 && user.length > 0;
  const adminOk = admins.length > 0;
  return {
    needsSetup: !smtpOk || !adminOk,
    smtpConfigured: smtpOk,
    adminConfigured: adminOk,
    checklist: [
      {
        id: 'database',
        ok: true,
        label: 'SQLite file and tables (created when the server starts; see Database below)',
      },
      {
        id: 'smtp',
        ok: smtpOk,
        label: 'SMTP (host and user; password required for most providers)',
      },
      {
        id: 'admin',
        ok: adminOk,
        label: 'At least one admin email (sign-in gets admin role for these addresses)',
      },
    ],
  };
}

/** Exposed for GET /setup/status: current path, whether file exists, and copy for the UI. */
function getDatabaseInfo() {
  const rel = String(settings.dbPath || './data/builder.db').trim();
  const abs = path.isAbsolute(rel) ? rel : path.resolve(PROJECT_ROOT, rel);
  let fileExists = false;
  try {
    fileExists = fs.existsSync(abs);
  } catch (_) {
    /* ignore */
  }
  return {
    envRelativePath: rel,
    resolvedAbsolutePath: abs,
    fileExists,
    schemaInitializedOnServerStart: true,
    hint:
      'The SQLite database file and tables are created when the server process starts (before you use this wizard). You do not run a separate database installer. To store data somewhere else, set BUILDER_DB_PATH in the form (writes .env) and restart the server so it opens that file.',
  };
}

function getExpectedToken() {
  const fromEnv = (process.env.RUMI_SETUP_TOKEN || '').trim();
  if (fromEnv) return fromEnv;
  try {
    if (fs.existsSync(SETUP_TOKEN_FILE)) {
      return fs.readFileSync(SETUP_TOKEN_FILE, 'utf8').trim();
    }
  } catch (e) {
    console.error('[Setup] Could not read setup token file:', e.message);
  }
  return '';
}

/**
 * When core env is missing, ensure a token exists so only someone with server access can POST /setup.
 */
function ensureSetupTokenOnDisk() {
  const { needsSetup } = computeNeedsSetup();
  if (!needsSetup) return;

  if ((process.env.RUMI_SETUP_TOKEN || '').trim()) {
    console.log('[Setup] Initial configuration pending. Using RUMI_SETUP_TOKEN from the environment.');
    console.log('[Setup] Open https://your-host/builder/setup (or /builder/setup) and complete the form.');
    return;
  }

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('[Setup] Could not create data directory:', e.message);
    return;
  }

  if (!fs.existsSync(SETUP_TOKEN_FILE)) {
    const tok = crypto.randomBytes(24).toString('hex');
    fs.writeFileSync(SETUP_TOKEN_FILE, tok, { mode: 0o600 });
    console.log('[Setup] Initial configuration is required (SMTP + admin emails).');
    console.log('[Setup] One-time setup token (save it; also written to data/.setup_token):');
    console.log(`[Setup] ${tok}`);
    console.log('[Setup] Open /builder/setup in the browser and paste this token.');
  } else {
    console.log('[Setup] Initial configuration is still pending. Token: data/.setup_token (or set RUMI_SETUP_TOKEN).');
    console.log('[Setup] Open /builder/setup to finish SMTP and admin email settings.');
  }
}

function escapeEnvValue(v) {
  const s = v == null ? '' : String(v);
  if (s === '') return '""';
  if (/[\n\r#]/.test(s) || /^\s/.test(s) || /\s$/.test(s) || /["'\\]/.test(s)) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return s;
}

function mergeEnvLines(lines, key, value) {
  const newLine = `${key}=${escapeEnvValue(value)}`;
  let found = false;
  const out = lines.map((line) => {
    if (line.trim().startsWith('#')) return line;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (m && m[1] === key) {
      found = true;
      return newLine;
    }
    return line;
  });
  if (!found) {
    if (out.length && out[out.length - 1] !== '') out.push('');
    out.push(newLine);
  }
  return out;
}

function writeEnvUpdates(updates) {
  let lines = [];
  if (fs.existsSync(ENV_PATH)) {
    lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
  }
  Object.keys(updates).forEach((key) => {
    const val = updates[key];
    if (val === undefined) return;
    lines = mergeEnvLines(lines, key, val);
  });
  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n', { mode: 0o600 });

  Object.keys(updates).forEach((key) => {
    if (updates[key] !== undefined) {
      process.env[key] = updates[key] == null ? '' : String(updates[key]);
    }
  });

  settings.reloadSettingsFromEnv();
  resetTransporter();
}

/** 32 bytes hex (64 chars). Used for AES-256-GCM key derivation for stored AI API keys. */
function generateAiConfigSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function validateSetupPayload(body) {
  const smtpHost = String(body.smtpHost || '').trim();
  const smtpUser = String(body.smtpUser || '').trim();
  const smtpPass = body.smtpPass != null ? String(body.smtpPass) : '';
  const smtpPort = parseInt(String(body.smtpPort || '587'), 10) || 587;
  const emailFrom = String(body.emailFrom || 'noreply@rumi.run').trim() || 'noreply@rumi.run';
  const adminEmails = parseAdminList(body.adminEmails);
  const superAdminEmails = parseAdminList(body.superAdminEmails || '');
  const aiConfigSecret = String(body.aiConfigSecret || '').trim();
  const dbPathRaw = String(body.dbPath ?? '').trim();

  const errors = [];
  if (!smtpHost) errors.push('SMTP host is required.');
  if (!smtpUser) errors.push('SMTP user is required.');
  if (!adminEmails.length) errors.push('At least one admin email is required.');

  let dbPath = dbPathRaw || './data/builder.db';
  if (dbPath.length > 512 || /[\r\n]/.test(dbPath)) {
    errors.push('Invalid database path.');
  }

  return {
    ok: errors.length === 0,
    errors,
    values: {
      smtpHost,
      smtpUser,
      smtpPass,
      smtpPort,
      emailFrom,
      adminEmails,
      superAdminEmails,
      aiConfigSecret,
      dbPath,
    },
  };
}

function buildEnvMapFromValues(v) {
  const map = {
    RUMI_SMTP_HOST: v.smtpHost,
    RUMI_SMTP_PORT: String(v.smtpPort),
    RUMI_SMTP_USER: v.smtpUser,
    RUMI_SMTP_PASS: v.smtpPass,
    RUMI_EMAIL_FROM: v.emailFrom,
    RUMI_ADMIN_EMAILS: v.adminEmails.join(','),
  };
  if (v.superAdminEmails.length) {
    map.RUMI_SUPERADMIN_EMAILS = v.superAdminEmails.join(',');
  } else {
    map.RUMI_SUPERADMIN_EMAILS = '';
  }
  if (v.aiConfigSecret) {
    map.RUMI_AI_CONFIG_SECRET = v.aiConfigSecret;
  }
  map.BUILDER_DB_PATH = v.dbPath;
  return map;
}

function removeSetupTokenFile() {
  try {
    if (fs.existsSync(SETUP_TOKEN_FILE)) {
      fs.unlinkSync(SETUP_TOKEN_FILE);
    }
  } catch (e) {
    console.error('[Setup] Could not remove setup token file:', e.message);
  }
}

function verifySetupToken(token) {
  const expected = getExpectedToken();
  if (!expected) return false;
  const t = String(token || '').trim();
  if (!t || t.length < 8) return false;
  try {
    const a = Buffer.from(t, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function applySetup(body) {
  const status = computeNeedsSetup();
  if (!status.needsSetup) {
    const err = new Error('SETUP_ALREADY_COMPLETE');
    err.code = 'SETUP_ALREADY_COMPLETE';
    throw err;
  }

  const parsed = validateSetupPayload(body);
  if (!parsed.ok) {
    const err = new Error(parsed.errors.join(' '));
    err.code = 'VALIDATION';
    err.details = parsed.errors;
    throw err;
  }

  function normDb(p) {
    const s = String(p || '').trim();
    return s || './data/builder.db';
  }
  const prevDb = normDb(process.env.BUILDER_DB_PATH);
  const envMap = buildEnvMapFromValues(parsed.values);
  const newDb = normDb(parsed.values.dbPath);
  const dbPathChanged = newDb !== prevDb;

  writeEnvUpdates(envMap);
  removeSetupTokenFile();

  console.log('[Setup] Core settings saved to .env. SMTP and admin lists are active in this process.');
  const out = { ok: true, needsSetup: false };
  if (dbPathChanged) {
    out.restartRequired = true;
    out.restartHint =
      'BUILDER_DB_PATH was updated in .env. Restart the server so the app connects to the new SQLite file (initDb will create tables there on startup).';
  }
  return out;
}

module.exports = {
  computeNeedsSetup,
  getDatabaseInfo,
  ensureSetupTokenOnDisk,
  getExpectedToken,
  verifySetupToken,
  applySetup,
  writeEnvUpdates,
  generateAiConfigSecret,
  ENV_PATH,
  SETUP_TOKEN_FILE,
};
