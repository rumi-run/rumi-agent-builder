const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { db } = require('../db');
const { requireAuth } = require('../middleware');
const authService = require('../services/authService');
const { fetchSsoMe } = require('../services/ssoClient');

function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

function generateToken() {
  return crypto.randomBytes(16).toString('base64url');
}

async function getOptionalAuthUser(req) {
  const cookieHeader = req.headers.cookie || '';
  const ssoUser = await fetchSsoMe(cookieHeader);
  if (ssoUser) {
    const local = await authService.ensureLocalUserFromSso(ssoUser);
    if (local) return local;
  }

  const sessionId =
    req.cookies?.rumi_session ||
    (req.headers.authorization?.startsWith('Bearer ') && req.headers.authorization.slice(7));
  if (!sessionId) return null;
  return authService.getSession(sessionId);
}

// Create a share link for an agent
router.post('/:buildId/share', requireAuth, async (req, res) => {
  try {
    const { buildId } = req.params;
    const { permission = 'view', email, expiresInDays } = req.body;

    // Verify ownership
    const agent = await db.getAsync(
      `SELECT id, user_id FROM agent_builds WHERE id = ?`,
      [buildId]
    );
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (agent.user_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Only the owner can share this agent' });
    }

    if (!['view', 'edit'].includes(permission)) {
      return res.status(400).json({ error: 'Permission must be view or edit' });
    }

    const id = generateId();
    const shareToken = generateToken();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
      : null;

    await db.runAsync(
      `INSERT INTO agent_shares (id, build_id, owner_id, shared_with_email, share_token, permission, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, buildId, req.user.user_id, email || null, shareToken, permission, expiresAt]
    );

    res.json({
      share: {
        id,
        share_token: shareToken,
        permission,
        shared_with_email: email || null,
        expires_at: expiresAt,
      },
    });
  } catch (err) {
    console.error('[Sharing] Create share error:', err);
    res.status(500).json({ error: 'Failed to create share link' });
  }
});

// List shares for an agent
router.get('/:buildId/shares', requireAuth, async (req, res) => {
  try {
    const { buildId } = req.params;

    const agent = await db.getAsync(
      `SELECT user_id FROM agent_builds WHERE id = ?`,
      [buildId]
    );
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (agent.user_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Only the owner can view shares' });
    }

    const shares = await db.allAsync(
      `SELECT id, share_token, permission, shared_with_email, created_at, expires_at
       FROM agent_shares WHERE build_id = ? ORDER BY created_at DESC`,
      [buildId]
    );

    res.json({ shares });
  } catch (err) {
    console.error('[Sharing] List shares error:', err);
    res.status(500).json({ error: 'Failed to list shares' });
  }
});

// Revoke a share
router.delete('/revoke/:shareId', requireAuth, async (req, res) => {
  try {
    const share = await db.getAsync(
      `SELECT id, owner_id FROM agent_shares WHERE id = ?`,
      [req.params.shareId]
    );
    if (!share) return res.status(404).json({ error: 'Share not found' });
    if (share.owner_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Only the owner can revoke shares' });
    }

    await db.runAsync(`DELETE FROM agent_shares WHERE id = ?`, [req.params.shareId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Sharing] Revoke share error:', err);
    res.status(500).json({ error: 'Failed to revoke share' });
  }
});

// Access a shared agent via token (no auth required for view links)
router.get('/shared/:token', async (req, res) => {
  try {
    const share = await db.getAsync(
      `SELECT s.*, a.name, a.description, a.canvas_data, a.tags, a.status,
              u.name as owner_name, u.email as owner_email
       FROM agent_shares s
       JOIN agent_builds a ON a.id = s.build_id
       JOIN rumi_users u ON u.id = s.owner_id
       WHERE s.share_token = ?`,
      [req.params.token]
    );

    if (!share) return res.status(404).json({ error: 'Share link not found or expired' });

    // Check expiry
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Share link has expired' });
    }

    if (share.shared_with_email) {
      const user = await getOptionalAuthUser(req);
      if (!user || String(user.email || '').toLowerCase() !== String(share.shared_with_email).toLowerCase()) {
        return res.status(403).json({ error: 'This share link is restricted to a specific account' });
      }
    }

    res.json({
      agent: {
        id: share.build_id,
        name: share.name,
        description: share.description,
        canvas_data: safeJsonParse(share.canvas_data),
        tags: safeJsonParse(share.tags, []),
        status: share.status,
        owner_name: share.owner_name,
        owner_email: share.owner_email,
      },
      permission: share.permission,
    });
  } catch (err) {
    console.error('[Sharing] Access shared error:', err);
    res.status(500).json({ error: 'Failed to load shared agent' });
  }
});

// List agents shared with me
router.get('/shared-with-me', requireAuth, async (req, res) => {
  try {
    const shares = await db.allAsync(
      `SELECT s.id, s.permission, s.share_token, s.created_at,
              a.id as build_id, a.name, a.description, a.canvas_data, a.tags, a.status, a.updated_at,
              u.name as owner_name, u.email as owner_email
       FROM agent_shares s
       JOIN agent_builds a ON a.id = s.build_id
       JOIN rumi_users u ON u.id = s.owner_id
       WHERE s.shared_with_email = ?
       AND (s.expires_at IS NULL OR s.expires_at > datetime('now'))
       ORDER BY s.created_at DESC`,
      [req.user.email]
    );

    res.json({
      agents: shares.map((s) => ({
        id: s.build_id,
        name: s.name,
        description: s.description,
        canvas_data: safeJsonParse(s.canvas_data),
        tags: safeJsonParse(s.tags, []),
        status: s.status,
        updated_at: s.updated_at,
        owner_name: s.owner_name,
        owner_email: s.owner_email,
        permission: s.permission,
        share_token: s.share_token,
      })),
    });
  } catch (err) {
    console.error('[Sharing] Shared-with-me error:', err);
    res.status(500).json({ error: 'Failed to load shared agents' });
  }
});

function safeJsonParse(str, fallback = {}) {
  try {
    return JSON.parse(str || '{}');
  } catch {
    return fallback;
  }
}

module.exports = router;
