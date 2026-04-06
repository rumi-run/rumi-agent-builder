const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { db } = require('../db');
const { requireAuth } = require('../middleware');

function generateId() {
  return crypto.randomBytes(12).toString('hex');
}

// GET published community templates (public, for template gallery)
router.get('/public', async (req, res) => {
  try {
    const rows = await db.allAsync(
      `SELECT id, slug, name, description, category, icon, canvas_data, created_at
       FROM published_system_templates ORDER BY created_at DESC`
    );
    const templates = rows.map((r) => {
      let canvas = { nodes: [], edges: [] };
      try {
        canvas = JSON.parse(r.canvas_data || '{}');
      } catch {
        /* ignore */
      }
      return {
        id: `community-${r.slug}`,
        name: r.name,
        description: r.description || '',
        category: r.category || 'enterprise',
        icon: r.icon || '📋',
        isCommunity: true,
        nodes: canvas.nodes || [],
        edges: canvas.edges || [],
      };
    });
    res.json({ templates });
  } catch (err) {
    console.error('[CommunityTemplates] Public list error:', err);
    res.status(500).json({ error: 'Failed to load community templates' });
  }
});

// POST submit agent canvas for system template review
router.post('/submit', requireAuth, async (req, res) => {
  try {
    const {
      buildId,
      proposedName,
      proposedDescription = '',
      proposedCategory = 'enterprise',
      proposedIcon = '📋',
    } = req.body;

    if (!buildId || !proposedName || String(proposedName).trim().length < 3) {
      return res.status(400).json({ error: 'buildId and proposedName (at least 3 characters) are required' });
    }

    const agent = await db.getAsync(
      `SELECT id, user_id, canvas_data FROM agent_builds WHERE id = ?`,
      [buildId]
    );
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (agent.user_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Only the owner can submit this agent as a template' });
    }

    const pending = await db.getAsync(
      `SELECT id FROM template_submissions WHERE build_id = ? AND status = 'pending'`,
      [buildId]
    );
    if (pending) {
      return res.status(409).json({
        error: 'A submission is already pending review for this agent',
      });
    }

    let canvas;
    try {
      canvas = JSON.parse(agent.canvas_data || '{}');
    } catch {
      return res.status(400).json({ error: 'Invalid canvas data' });
    }
    if (!canvas.nodes || !Array.isArray(canvas.nodes) || canvas.nodes.length === 0) {
      return res.status(400).json({ error: 'Agent canvas must contain at least one block to submit' });
    }

    const snapshot = JSON.stringify({
      nodes: canvas.nodes,
      edges: canvas.edges || [],
    });
    const id = generateId();
    const cat = String(proposedCategory || 'enterprise')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 64) || 'enterprise';

    await db.runAsync(
      `INSERT INTO template_submissions (
        id, build_id, submitter_user_id, proposed_name, proposed_description,
        proposed_category, proposed_icon, canvas_snapshot, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        id,
        buildId,
        req.user.user_id,
        String(proposedName).trim().slice(0, 200),
        String(proposedDescription).trim().slice(0, 2000),
        cat,
        String(proposedIcon).slice(0, 8),
        snapshot,
      ]
    );

    res.json({
      ok: true,
      submission: {
        id,
        status: 'pending',
        proposedName: String(proposedName).trim(),
      },
    });
  } catch (err) {
    console.error('[CommunityTemplates] Submit error:', err);
    res.status(500).json({ error: 'Failed to submit template' });
  }
});

// GET latest submission status for an agent (owner only)
router.get('/status/:buildId', requireAuth, async (req, res) => {
  try {
    const { buildId } = req.params;
    const agent = await db.getAsync(`SELECT user_id FROM agent_builds WHERE id = ?`, [buildId]);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (agent.user_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const row = await db.getAsync(
      `SELECT id, status, proposed_name, rejection_reason, reviewed_at, published_public_id, created_at
       FROM template_submissions WHERE build_id = ? ORDER BY created_at DESC LIMIT 1`,
      [buildId]
    );

    res.json({ submission: row || null });
  } catch (err) {
    console.error('[CommunityTemplates] Status error:', err);
    res.status(500).json({ error: 'Failed to load submission status' });
  }
});

module.exports = router;
