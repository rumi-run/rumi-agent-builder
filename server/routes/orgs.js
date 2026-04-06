const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { db } = require('../db');
const { requireAuth } = require('../middleware');

router.use(requireAuth);

function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

// Create an organization
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Organization name must be at least 2 characters' });
    }

    const id = generateId();
    let slug = slugify(name.trim());

    // Ensure unique slug
    const existing = await db.getAsync(`SELECT id FROM organizations WHERE slug = ?`, [slug]);
    if (existing) slug = `${slug}-${id.slice(0, 4)}`;

    await db.runAsync(
      `INSERT INTO organizations (id, name, slug, owner_id) VALUES (?, ?, ?, ?)`,
      [id, name.trim(), slug, req.user.user_id]
    );

    // Add owner as member with 'owner' role
    await db.runAsync(
      `INSERT INTO org_members (org_id, user_id, role, joined_at) VALUES (?, ?, 'owner', datetime('now'))`,
      [id, req.user.user_id]
    );

    res.json({
      org: { id, name: name.trim(), slug, role: 'owner' },
    });
  } catch (err) {
    console.error('[Orgs] Create error:', err);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

// List my organizations
router.get('/', async (req, res) => {
  try {
    const orgs = await db.allAsync(
      `SELECT o.id, o.name, o.slug, o.created_at, m.role,
              (SELECT COUNT(*) FROM org_members WHERE org_id = o.id AND joined_at IS NOT NULL) as member_count,
              (SELECT COUNT(*) FROM agent_builds WHERE org_id = o.id) as agent_count
       FROM organizations o
       JOIN org_members m ON m.org_id = o.id AND m.user_id = ?
       WHERE m.joined_at IS NOT NULL
       ORDER BY o.name`,
      [req.user.user_id]
    );

    res.json({ orgs });
  } catch (err) {
    console.error('[Orgs] List error:', err);
    res.status(500).json({ error: 'Failed to load organizations' });
  }
});

// Get organization details
router.get('/:orgId', async (req, res) => {
  try {
    const member = await db.getAsync(
      `SELECT role FROM org_members WHERE org_id = ? AND user_id = ? AND joined_at IS NOT NULL`,
      [req.params.orgId, req.user.user_id]
    );
    if (!member) return res.status(403).json({ error: 'Not a member of this organization' });

    const org = await db.getAsync(
      `SELECT * FROM organizations WHERE id = ?`,
      [req.params.orgId]
    );
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const members = await db.allAsync(
      `SELECT m.user_id, m.role, m.joined_at, m.invited_email, m.invited_at,
              u.name, u.email, u.avatar_url
       FROM org_members m
       LEFT JOIN rumi_users u ON u.id = m.user_id
       WHERE m.org_id = ?
       ORDER BY m.role DESC, m.joined_at`,
      [req.params.orgId]
    );

    res.json({
      org: { ...org, my_role: member.role },
      members,
    });
  } catch (err) {
    console.error('[Orgs] Get error:', err);
    res.status(500).json({ error: 'Failed to load organization' });
  }
});

// Invite a member
router.post('/:orgId/invite', async (req, res) => {
  try {
    const { email, role = 'member' } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    if (!['member', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role must be member or admin' });
    }

    const myMembership = await db.getAsync(
      `SELECT role FROM org_members WHERE org_id = ? AND user_id = ? AND joined_at IS NOT NULL`,
      [req.params.orgId, req.user.user_id]
    );
    if (!myMembership || !['owner', 'admin'].includes(myMembership.role)) {
      return res.status(403).json({ error: 'Only owners and admins can invite members' });
    }

    // Check if already invited/member
    const existingByEmail = await db.getAsync(
      `SELECT m.id FROM org_members m
       LEFT JOIN rumi_users u ON u.id = m.user_id
       WHERE m.org_id = ? AND (u.email = ? OR m.invited_email = ?)`,
      [req.params.orgId, email.toLowerCase(), email.toLowerCase()]
    );
    if (existingByEmail) {
      return res.status(409).json({ error: 'User is already a member or has a pending invite' });
    }

    // Find user by email or create placeholder
    const user = await db.getAsync(`SELECT id FROM rumi_users WHERE email = ?`, [email.toLowerCase()]);
    const userId = user?.id || generateId();

    if (!user) {
      // Create placeholder user for the invite
      await db.runAsync(
        `INSERT OR IGNORE INTO rumi_users (id, email) VALUES (?, ?)`,
        [userId, email.toLowerCase()]
      );
    }

    await db.runAsync(
      `INSERT INTO org_members (org_id, user_id, role, invited_email, invited_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [req.params.orgId, userId, role, email.toLowerCase()]
    );

    res.json({ ok: true, invited: email.toLowerCase() });
  } catch (err) {
    console.error('[Orgs] Invite error:', err);
    res.status(500).json({ error: 'Failed to invite member' });
  }
});

// Accept invite (user joins the org)
router.post('/:orgId/join', async (req, res) => {
  try {
    const invite = await db.getAsync(
      `SELECT id, role FROM org_members
       WHERE org_id = ? AND user_id = ? AND joined_at IS NULL`,
      [req.params.orgId, req.user.user_id]
    );
    if (!invite) return res.status(404).json({ error: 'No pending invite found' });

    await db.runAsync(
      `UPDATE org_members SET joined_at = datetime('now') WHERE id = ?`,
      [invite.id]
    );

    res.json({ ok: true, role: invite.role });
  } catch (err) {
    console.error('[Orgs] Join error:', err);
    res.status(500).json({ error: 'Failed to join organization' });
  }
});

// Remove a member
router.delete('/:orgId/members/:userId', async (req, res) => {
  try {
    const myMembership = await db.getAsync(
      `SELECT role FROM org_members WHERE org_id = ? AND user_id = ? AND joined_at IS NOT NULL`,
      [req.params.orgId, req.user.user_id]
    );
    if (!myMembership || !['owner', 'admin'].includes(myMembership.role)) {
      return res.status(403).json({ error: 'Only owners and admins can remove members' });
    }

    // Can't remove the owner
    const target = await db.getAsync(
      `SELECT role FROM org_members WHERE org_id = ? AND user_id = ?`,
      [req.params.orgId, req.params.userId]
    );
    if (!target) return res.status(404).json({ error: 'Member not found' });
    if (target.role === 'owner') {
      return res.status(403).json({ error: 'Cannot remove the organization owner' });
    }

    await db.runAsync(
      `DELETE FROM org_members WHERE org_id = ? AND user_id = ?`,
      [req.params.orgId, req.params.userId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[Orgs] Remove member error:', err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Update member role
router.put('/:orgId/members/:userId', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['member', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role must be member or admin' });
    }

    const myMembership = await db.getAsync(
      `SELECT role FROM org_members WHERE org_id = ? AND user_id = ? AND joined_at IS NOT NULL`,
      [req.params.orgId, req.user.user_id]
    );
    if (!myMembership || myMembership.role !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can change roles' });
    }

    await db.runAsync(
      `UPDATE org_members SET role = ? WHERE org_id = ? AND user_id = ?`,
      [role, req.params.orgId, req.params.userId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[Orgs] Update role error:', err);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Move agent to org
router.post('/:orgId/agents/:buildId', async (req, res) => {
  try {
    const myMembership = await db.getAsync(
      `SELECT role FROM org_members WHERE org_id = ? AND user_id = ? AND joined_at IS NOT NULL`,
      [req.params.orgId, req.user.user_id]
    );
    if (!myMembership) return res.status(403).json({ error: 'Not a member of this organization' });

    const agent = await db.getAsync(
      `SELECT user_id FROM agent_builds WHERE id = ?`,
      [req.params.buildId]
    );
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (agent.user_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Only the agent owner can move it to an org' });
    }

    await db.runAsync(
      `UPDATE agent_builds SET org_id = ?, visibility = 'org' WHERE id = ?`,
      [req.params.orgId, req.params.buildId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[Orgs] Move agent error:', err);
    res.status(500).json({ error: 'Failed to move agent' });
  }
});

// List org agents
router.get('/:orgId/agents', async (req, res) => {
  try {
    const myMembership = await db.getAsync(
      `SELECT role FROM org_members WHERE org_id = ? AND user_id = ? AND joined_at IS NOT NULL`,
      [req.params.orgId, req.user.user_id]
    );
    if (!myMembership) return res.status(403).json({ error: 'Not a member of this organization' });

    const agents = await db.allAsync(
      `SELECT a.*, u.name as owner_name, u.email as owner_email
       FROM agent_builds a
       JOIN rumi_users u ON u.id = a.user_id
       WHERE a.org_id = ?
       ORDER BY a.updated_at DESC`,
      [req.params.orgId]
    );

    res.json({
      agents: agents.map((a) => ({
        ...a,
        canvas_data: safeJsonParse(a.canvas_data),
        tags: safeJsonParse(a.tags, []),
      })),
    });
  } catch (err) {
    console.error('[Orgs] List agents error:', err);
    res.status(500).json({ error: 'Failed to load org agents' });
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
