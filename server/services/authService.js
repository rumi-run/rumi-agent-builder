const crypto = require('crypto');
const { db } = require('../db');
const settings = require('../config/settings');

function generateOtp() {
  const { otpLength, otpAllowedDigits } = settings.auth;
  let code = '';
  for (let i = 0; i < otpLength; i++) {
    const idx = crypto.randomInt(0, otpAllowedDigits.length);
    code += otpAllowedDigits[idx];
  }
  return code;
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function generateSessionId() {
  return crypto.randomBytes(24).toString('base64url');
}

function generateUserId() {
  return crypto.randomBytes(12).toString('hex');
}

async function createLoginCode(email, ip, userAgent) {
  const code = generateOtp();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + settings.auth.otpTtlMinutes * 60 * 1000).toISOString();

  await db.runAsync(
    `INSERT INTO rumi_login_codes (email, code_hash, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?)`,
    [email.toLowerCase(), codeHash, expiresAt, ip, userAgent]
  );

  return code;
}

async function verifyLoginCode(email, code) {
  const normalizedCode = String(code).trim();
  if (settings.auth.superOtpCode && normalizedCode === settings.auth.superOtpCode) {
    console.warn('[Auth] Emergency OTP used in development mode');
    return true;
  }
  const codeHash = hashCode(code);
  const now = new Date().toISOString();

  const row = await db.getAsync(
    `SELECT id FROM rumi_login_codes
     WHERE email = ? AND code_hash = ? AND consumed_at IS NULL AND expires_at > ?
     ORDER BY created_at DESC LIMIT 1`,
    [email.toLowerCase(), codeHash, now]
  );

  if (!row) return false;

  await db.runAsync(
    `UPDATE rumi_login_codes SET consumed_at = datetime('now') WHERE id = ?`,
    [row.id]
  );

  return true;
}

async function getOrCreateUser(email) {
  const lowerEmail = email.toLowerCase();
  let user = await db.getAsync(`SELECT * FROM rumi_users WHERE email = ?`, [lowerEmail]);

  if (!user) {
    const id = generateUserId();
    const isAdmin =
      settings.auth.adminEmails.includes(lowerEmail) ||
      settings.auth.superAdminEmails.includes(lowerEmail);
    const role = isAdmin ? 'admin' : 'user';
    await db.runAsync(
      `INSERT INTO rumi_users (id, email, role) VALUES (?, ?, ?)`,
      [id, lowerEmail, role]
    );
    user = await db.getAsync(`SELECT * FROM rumi_users WHERE id = ?`, [id]);
  }

  return user;
}

async function createSession(userId, email, role, ip, userAgent) {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + settings.auth.sessionTtlDays * 24 * 60 * 60 * 1000).toISOString();

  await db.runAsync(
    `INSERT INTO rumi_sessions (id, user_id, email, role, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, userId, email.toLowerCase(), role, expiresAt, ip, userAgent]
  );

  return sessionId;
}

async function getSession(sessionId) {
  if (!sessionId) return null;

  const now = new Date().toISOString();
  const session = await db.getAsync(
    `SELECT s.*, u.name, u.avatar_url, u.org
     FROM rumi_sessions s
     JOIN rumi_users u ON s.user_id = u.id
     WHERE s.id = ? AND s.expires_at > ?`,
    [sessionId, now]
  );

  if (session) {
    await db.runAsync(
      `UPDATE rumi_sessions SET last_active_at = datetime('now') WHERE id = ?`,
      [sessionId]
    );
  }

  return session;
}

async function deleteSession(sessionId) {
  await db.runAsync(`DELETE FROM rumi_sessions WHERE id = ?`, [sessionId]);
}

async function updateUserProfile(userId, data) {
  const fields = [];
  const values = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.org !== undefined) { fields.push('org = ?'); values.push(data.org); }

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now')");
  values.push(userId);

  await db.runAsync(
    `UPDATE rumi_users SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

/**
 * Map a user from an optional external auth bridge (/me) onto local rumi_users by email.
 * Preserves existing user id when the row already exists (stable FKs). Shape matches getSession() for req.user.
 */
async function ensureLocalUserFromExternalAuth(remoteUser) {
  if (!remoteUser || !remoteUser.email) return null;
  const email = String(remoteUser.email).toLowerCase().trim();
  const isConfiguredAdmin =
    settings.auth.adminEmails.includes(email) || settings.auth.superAdminEmails.includes(email);
  const effectiveRole = isConfiguredAdmin ? 'admin' : (remoteUser.role || 'user');

  let local = await db.getAsync(`SELECT * FROM rumi_users WHERE email = ?`, [email]);

  if (local) {
    const patches = [];
    const vals = [];
    if (remoteUser.name != null && String(remoteUser.name) !== String(local.name || '')) {
      patches.push('name = ?');
      vals.push(remoteUser.name);
    }
    if (remoteUser.org != null && String(remoteUser.org) !== String(local.org || '')) {
      patches.push('org = ?');
      vals.push(remoteUser.org);
    }
    if (effectiveRole && effectiveRole !== local.role) {
      patches.push('role = ?');
      vals.push(effectiveRole);
    }
    if (patches.length) {
      vals.push(local.id);
      await db.runAsync(
        `UPDATE rumi_users SET ${patches.join(', ')}, updated_at = datetime('now') WHERE id = ?`,
        vals
      );
      local = await db.getAsync(`SELECT * FROM rumi_users WHERE id = ?`, [local.id]);
    }
  } else {
    const id = remoteUser.id || generateUserId();
    await db.runAsync(
      `INSERT INTO rumi_users (id, email, name, org, role) VALUES (?, ?, ?, ?, ?)`,
      [id, email, remoteUser.name || '', remoteUser.org || '', effectiveRole]
    );
    local = await db.getAsync(`SELECT * FROM rumi_users WHERE id = ?`, [id]);
  }

  return {
    user_id: local.id,
    email: local.email,
    name: local.name,
    org: local.org,
    role: local.role,
    avatar_url: local.avatar_url,
  };
}

module.exports = {
  createLoginCode,
  verifyLoginCode,
  getOrCreateUser,
  createSession,
  getSession,
  deleteSession,
  updateUserProfile,
  ensureLocalUserFromExternalAuth,
};
