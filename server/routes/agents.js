const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { db } = require('../db');
const { requireAuth } = require('../middleware');

router.use(requireAuth);

function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

// List user's agent builds
router.get('/', async (req, res) => {
  try {
    const agents = await db.allAsync(
      `SELECT id, name, description, canvas_data, tags, status, created_at, updated_at
       FROM agent_builds WHERE user_id = ? ORDER BY updated_at DESC`,
      [req.user.user_id]
    );

    res.json({
      agents: agents.map((a) => ({
        ...a,
        canvas_data: safeJsonParse(a.canvas_data),
        tags: safeJsonParse(a.tags, []),
      })),
    });
  } catch (err) {
    console.error('[Agents] List error:', err);
    res.status(500).json({ error: 'Failed to load agents' });
  }
});

// Get single agent build (owner, shared, or org member)
router.get('/:id', async (req, res) => {
  try {
    let agent = await db.getAsync(
      `SELECT * FROM agent_builds WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.user_id]
    );

    // Check org access if not owner
    if (!agent) {
      agent = await db.getAsync(
        `SELECT a.* FROM agent_builds a
         JOIN org_members m ON m.org_id = a.org_id AND m.user_id = ? AND m.joined_at IS NOT NULL
         WHERE a.id = ? AND a.visibility = 'org'`,
        [req.user.user_id, req.params.id]
      );
    }

    // Check share access
    if (!agent) {
      const share = await db.getAsync(
        `SELECT a.* FROM agent_builds a
         JOIN agent_shares s ON s.build_id = a.id
         WHERE a.id = ? AND s.shared_with_email = ?
         AND (s.expires_at IS NULL OR s.expires_at > datetime('now'))`,
        [req.params.id, req.user.email]
      );
      if (share) agent = share;
    }

    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    res.json({
      agent: {
        ...agent,
        canvas_data: safeJsonParse(agent.canvas_data),
        tags: safeJsonParse(agent.tags, []),
      },
    });
  } catch (err) {
    console.error('[Agents] Get error:', err);
    res.status(500).json({ error: 'Failed to load agent' });
  }
});

// Create agent build
router.post('/', async (req, res) => {
  try {
    const id = generateId();
    const { name = 'Untitled Agent', description = '', canvas_data = {} } = req.body;

    await db.runAsync(
      `INSERT INTO agent_builds (id, user_id, name, description, canvas_data) VALUES (?, ?, ?, ?, ?)`,
      [id, req.user.user_id, name, description, JSON.stringify(canvas_data)]
    );

    const agent = await db.getAsync(`SELECT * FROM agent_builds WHERE id = ?`, [id]);
    res.json({
      agent: {
        ...agent,
        canvas_data: safeJsonParse(agent.canvas_data),
        tags: safeJsonParse(agent.tags, []),
      },
    });
  } catch (err) {
    console.error('[Agents] Create error:', err);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// Check if user has edit access to a build (owner, shared-edit, or org member)
async function checkEditAccess(buildId, userId, userEmail) {
  // Owner
  const owned = await db.getAsync(
    `SELECT id FROM agent_builds WHERE id = ? AND user_id = ?`,
    [buildId, userId]
  );
  if (owned) return 'owner';

  // Shared with edit permission
  const shared = await db.getAsync(
    `SELECT permission FROM agent_shares
     WHERE build_id = ? AND shared_with_email = ? AND permission = 'edit'
     AND (expires_at IS NULL OR expires_at > datetime('now'))`,
    [buildId, userEmail]
  );
  if (shared) return 'edit';

  // Org member
  const orgAccess = await db.getAsync(
    `SELECT a.id FROM agent_builds a
     JOIN org_members m ON m.org_id = a.org_id AND m.user_id = ? AND m.joined_at IS NOT NULL
     WHERE a.id = ? AND a.visibility = 'org'`,
    [userId, buildId]
  );
  if (orgAccess) return 'edit';

  return null;
}

// Update agent build
router.put('/:id', async (req, res) => {
  try {
    const accessLevel = await checkEditAccess(req.params.id, req.user.user_id, req.user.email);
    if (!accessLevel) return res.status(404).json({ error: 'Agent not found' });

    const { name, description, canvas_data, tags, status, expected_updated_at } = req.body;

    // Validate canvas_data size (max 5MB serialized)
    if (canvas_data !== undefined) {
      const serialized = JSON.stringify(canvas_data);
      if (serialized.length > 5 * 1024 * 1024) {
        return res.status(413).json({ error: 'Canvas data too large (max 5MB)' });
      }
    }

    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (canvas_data !== undefined) { updates.push('canvas_data = ?'); values.push(JSON.stringify(canvas_data)); }
    if (tags !== undefined) { updates.push('tags = ?'); values.push(JSON.stringify(tags)); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      let updateSql = `UPDATE agent_builds SET ${updates.join(', ')} WHERE id = ?`;
      values.push(req.params.id);
      if (expected_updated_at) {
        updateSql += ` AND updated_at = ?`;
        values.push(expected_updated_at);
      }
      const updateResult = await db.runAsync(updateSql, values);

      if (expected_updated_at && updateResult.changes === 0) {
        const current = await db.getAsync(
          `SELECT updated_at FROM agent_builds WHERE id = ?`,
          [req.params.id]
        );
        return res.status(409).json({
          error: 'Conflict: agent was modified by another user',
          server_updated_at: current?.updated_at || null,
        });
      }

      // Create version snapshot when canvas_data changes
      if (canvas_data !== undefined) {
        const versionCount = await db.getAsync(
          `SELECT COALESCE(MAX(version_num), 0) as max_ver FROM agent_build_versions WHERE build_id = ?`,
          [req.params.id]
        );
        await db.runAsync(
          `INSERT INTO agent_build_versions (build_id, version_num, canvas_data, user_id, user_email, note)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [req.params.id, (versionCount?.max_ver || 0) + 1, JSON.stringify(canvas_data),
           req.user.user_id, req.user.email, `Saved by ${req.user.email}`]
        );
      }

      // Log activity
      const changedFields = [];
      if (name !== undefined) changedFields.push('name');
      if (description !== undefined) changedFields.push('description');
      if (canvas_data !== undefined) changedFields.push('canvas');
      if (tags !== undefined) changedFields.push('tags');
      if (status !== undefined) changedFields.push('status');

      await db.runAsync(
        `INSERT INTO activity_log (build_id, user_id, user_email, action, details) VALUES (?, ?, ?, ?, ?)`,
        [req.params.id, req.user.user_id, req.user.email, 'update',
         JSON.stringify({ fields: changedFields })]
      ).catch(() => {});
    }

    // Return the new updated_at for conflict detection
    const updated = await db.getAsync(
      `SELECT updated_at FROM agent_builds WHERE id = ?`,
      [req.params.id]
    );
    res.json({ ok: true, updated_at: updated?.updated_at });
  } catch (err) {
    console.error('[Agents] Update error:', err);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

// Delete agent build
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.runAsync(
      `DELETE FROM agent_builds WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.user_id]
    );

    if (result.changes === 0) return res.status(404).json({ error: 'Agent not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[Agents] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

// Duplicate agent build
router.post('/:id/duplicate', async (req, res) => {
  try {
    const original = await db.getAsync(
      `SELECT * FROM agent_builds WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.user_id]
    );
    if (!original) return res.status(404).json({ error: 'Agent not found' });

    const id = generateId();
    await db.runAsync(
      `INSERT INTO agent_builds (id, user_id, name, description, canvas_data, tags, status)
       VALUES (?, ?, ?, ?, ?, ?, 'draft')`,
      [id, req.user.user_id, `${original.name} (Copy)`, original.description, original.canvas_data, original.tags]
    );

    const agent = await db.getAsync(`SELECT * FROM agent_builds WHERE id = ?`, [id]);
    res.json({
      agent: {
        ...agent,
        canvas_data: safeJsonParse(agent.canvas_data),
        tags: safeJsonParse(agent.tags, []),
      },
    });
  } catch (err) {
    console.error('[Agents] Duplicate error:', err);
    res.status(500).json({ error: 'Failed to duplicate agent' });
  }
});

// Get activity log for an agent
router.get('/:id/activity', async (req, res) => {
  try {
    const accessLevel = await checkEditAccess(req.params.id, req.user.user_id, req.user.email);
    if (!accessLevel) return res.status(404).json({ error: 'Agent not found' });

    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const activities = await db.allAsync(
      `SELECT id, user_id, user_email, action, details, created_at
       FROM activity_log WHERE build_id = ? ORDER BY created_at DESC LIMIT ?`,
      [req.params.id, limit]
    );

    res.json({
      activities: activities.map((a) => ({
        ...a,
        details: safeJsonParse(a.details),
      })),
    });
  } catch (err) {
    console.error('[Agents] Activity log error:', err);
    res.status(500).json({ error: 'Failed to load activity log' });
  }
});

// Get version history for an agent
router.get('/:id/versions', async (req, res) => {
  try {
    const accessLevel = await checkEditAccess(req.params.id, req.user.user_id, req.user.email);
    if (!accessLevel) return res.status(404).json({ error: 'Agent not found' });

    const versions = await db.allAsync(
      `SELECT id, version_num, user_id, user_email, note, created_at
       FROM agent_build_versions WHERE build_id = ? ORDER BY version_num DESC LIMIT 50`,
      [req.params.id]
    );

    res.json({ versions });
  } catch (err) {
    console.error('[Agents] Versions error:', err);
    res.status(500).json({ error: 'Failed to load versions' });
  }
});

// Restore a specific version
router.post('/:id/versions/:versionId/restore', async (req, res) => {
  try {
    const accessLevel = await checkEditAccess(req.params.id, req.user.user_id, req.user.email);
    if (!accessLevel) return res.status(404).json({ error: 'Agent not found' });

    const version = await db.getAsync(
      `SELECT canvas_data FROM agent_build_versions WHERE id = ? AND build_id = ?`,
      [req.params.versionId, req.params.id]
    );
    if (!version) return res.status(404).json({ error: 'Version not found' });

    await db.runAsync(
      `UPDATE agent_builds SET canvas_data = ?, updated_at = datetime('now') WHERE id = ?`,
      [version.canvas_data, req.params.id]
    );

    await db.runAsync(
      `INSERT INTO activity_log (build_id, user_id, user_email, action, details) VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, req.user.user_id, req.user.email, 'restore_version',
       JSON.stringify({ versionId: req.params.versionId })]
    ).catch(() => {});

    res.json({ ok: true, canvas_data: safeJsonParse(version.canvas_data) });
  } catch (err) {
    console.error('[Agents] Restore version error:', err);
    res.status(500).json({ error: 'Failed to restore version' });
  }
});

// Get access info for an agent (who has access)
router.get('/:id/access', async (req, res) => {
  try {
    const accessLevel = await checkEditAccess(req.params.id, req.user.user_id, req.user.email);
    if (!accessLevel) return res.status(404).json({ error: 'Agent not found' });

    const agent = await db.getAsync(
      `SELECT user_id, org_id, visibility FROM agent_builds WHERE id = ?`,
      [req.params.id]
    );

    const owner = await db.getAsync(
      `SELECT id, email, name FROM rumi_users WHERE id = ?`,
      [agent.user_id]
    );

    const shares = await db.allAsync(
      `SELECT id, shared_with_email, permission, created_at, expires_at
       FROM agent_shares WHERE build_id = ?
       AND (expires_at IS NULL OR expires_at > datetime('now'))
       ORDER BY created_at DESC`,
      [req.params.id]
    );

    let orgMembers = [];
    if (agent.org_id && agent.visibility === 'org') {
      orgMembers = await db.allAsync(
        `SELECT m.user_id, m.role, u.email, u.name
         FROM org_members m
         JOIN rumi_users u ON u.id = m.user_id
         WHERE m.org_id = ? AND m.joined_at IS NOT NULL`,
        [agent.org_id]
      );
    }

    res.json({
      owner: { id: owner.id, email: owner.email, name: owner.name },
      shares,
      orgMembers,
      myAccess: accessLevel,
    });
  } catch (err) {
    console.error('[Agents] Access info error:', err);
    res.status(500).json({ error: 'Failed to load access info' });
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
