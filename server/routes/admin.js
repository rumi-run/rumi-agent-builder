const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { db } = require('../db');
const settings = require('../config/settings');
const { requireAuth, requireAdmin, requireSuperAdmin } = require('../middleware');
const { encryptApiKeyForStorage } = require('../utils/aiKeyCrypto');
const { writeEnvUpdates, generateAiConfigSecret } = require('../services/setupService');

function generateId() {
  return crypto.randomBytes(12).toString('hex');
}

function slugify(name) {
  const s = String(name || 'template')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return s || 'template';
}

router.use(requireAuth);
router.use(requireAdmin);

// Generate RUMI_AI_CONFIG_SECRET and persist to .env (only when not already set)
router.post('/generate-ai-config-secret', (req, res) => {
  try {
    if (settings.ai.configSecretConfigured) {
      return res.status(409).json({
        error:
          'RUMI_AI_CONFIG_SECRET is already set. To replace it, edit .env manually. Rotating invalidates keys encrypted with the old secret.',
      });
    }
    const secret = generateAiConfigSecret();
    writeEnvUpdates({ RUMI_AI_CONFIG_SECRET: secret });
    console.log('[Admin] RUMI_AI_CONFIG_SECRET generated and written to .env');
    res.json({ ok: true, configSecretConfigured: true });
  } catch (err) {
    console.error('[Admin] generate-ai-config-secret error:', err);
    res.status(500).json({ error: 'Failed to save encryption key' });
  }
});

// Get AI config
router.get('/ai-config', async (req, res) => {
  try {
    let config = await db.getAsync(`SELECT * FROM ai_config WHERE id = 1`);

    if (!config) {
      await db.runAsync(
        `INSERT OR IGNORE INTO ai_config (id) VALUES (1)`
      );
      config = await db.getAsync(`SELECT * FROM ai_config WHERE id = 1`);
    }

    res.json({
      config: {
        apiProvider: config.api_provider,
        apiEndpoint: config.api_endpoint,
        apiKeySet: !!config.api_key_encrypted,
        defaultModel: config.default_model,
        rateLimitPerUser: config.rate_limit_per_user,
        rateLimitWindow: config.rate_limit_window,
        enabled: !!config.enabled,
        configSecretConfigured: !!settings.ai.configSecretConfigured,
      },
    });
  } catch (err) {
    console.error('[Admin] Get AI config error:', err);
    res.status(500).json({ error: 'Failed to load config' });
  }
});

// Update AI config
router.put('/ai-config', async (req, res) => {
  try {
    const {
      apiProvider,
      apiEndpoint,
      apiKey,
      defaultModel,
      rateLimitPerUser,
      rateLimitWindow,
      enabled,
    } = req.body;

    // Ensure row exists
    await db.runAsync(`INSERT OR IGNORE INTO ai_config (id) VALUES (1)`);

    const updates = [];
    const values = [];

    if (apiProvider !== undefined) { updates.push('api_provider = ?'); values.push(apiProvider); }
    if (apiEndpoint !== undefined) { updates.push('api_endpoint = ?'); values.push(apiEndpoint); }
    if (apiKey !== undefined) {
      try {
        const stored = encryptApiKeyForStorage(apiKey);
        updates.push('api_key_encrypted = ?');
        values.push(stored);
      } catch (e) {
        if (e.code === 'MISSING_AI_CONFIG_SECRET' || e.message?.includes('RUMI_AI_CONFIG_SECRET')) {
          return res.status(503).json({ error: e.message });
        }
        throw e;
      }
    }
    if (defaultModel !== undefined) { updates.push('default_model = ?'); values.push(defaultModel); }
    if (rateLimitPerUser !== undefined) { updates.push('rate_limit_per_user = ?'); values.push(rateLimitPerUser); }
    if (rateLimitWindow !== undefined) { updates.push('rate_limit_window = ?'); values.push(rateLimitWindow); }
    if (enabled !== undefined) { updates.push('enabled = ?'); values.push(enabled ? 1 : 0); }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(1);
      await db.runAsync(
        `UPDATE ai_config SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[Admin] Update AI config error:', err);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

// Get user list (paginated)
router.get('/users', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const search = (req.query.search || '').trim();
    const offset = (page - 1) * limit;

    let whereClause = '';
    const countParams = [];
    const queryParams = [];

    if (search) {
      whereClause = `WHERE u.email LIKE ? OR u.name LIKE ?`;
      const pattern = `%${search}%`;
      countParams.push(pattern, pattern);
      queryParams.push(pattern, pattern);
    }

    const total = await db.getAsync(
      `SELECT COUNT(*) as count FROM rumi_users u ${whereClause}`,
      countParams
    );

    queryParams.push(limit, offset);
    const users = await db.allAsync(
      `SELECT u.id, u.email, u.name, u.role, u.org, u.created_at,
              (SELECT COUNT(*) FROM agent_builds WHERE user_id = u.id) as agent_count,
              (SELECT MAX(updated_at) FROM agent_builds WHERE user_id = u.id) as last_active
       FROM rumi_users u ${whereClause} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      queryParams
    );

    res.json({
      users,
      pagination: {
        page,
        limit,
        total: total.count,
        totalPages: Math.ceil(total.count / limit),
      },
    });
  } catch (err) {
    console.error('[Admin] Get users error:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// Get usage stats
router.get('/usage', async (req, res) => {
  try {
    const totalUsers = await db.getAsync(`SELECT COUNT(*) as count FROM rumi_users`);
    const totalAgents = await db.getAsync(`SELECT COUNT(*) as count FROM agent_builds`);
    const aiUsageToday = await db.getAsync(
      `SELECT COUNT(*) as count, COALESCE(SUM(tokens_used), 0) as tokens
       FROM ai_usage_logs WHERE created_at >= date('now')`
    );

    res.json({
      stats: {
        totalUsers: totalUsers.count,
        totalAgents: totalAgents.count,
        aiRequestsToday: aiUsageToday.count,
        aiTokensToday: aiUsageToday.tokens,
      },
    });
  } catch (err) {
    console.error('[Admin] Get usage error:', err);
    res.status(500).json({ error: 'Failed to load usage' });
  }
});

// --- System template submissions (super admin only) ---
router.get('/template-submissions', requireSuperAdmin, async (req, res) => {
  try {
    const status = (req.query.status || 'pending').trim();
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status filter' });
    }
    const rows = await db.allAsync(
      `SELECT s.*, u.email AS submitter_email, b.name AS build_name
       FROM template_submissions s
       JOIN rumi_users u ON u.id = s.submitter_user_id
       JOIN agent_builds b ON b.id = s.build_id
       WHERE s.status = ?
       ORDER BY s.created_at ASC`,
      [status]
    );
    res.json({ submissions: rows });
  } catch (err) {
    console.error('[Admin] List template submissions error:', err);
    res.status(500).json({ error: 'Failed to load submissions' });
  }
});

router.post('/template-submissions/:id/approve', requireSuperAdmin, async (req, res) => {
  try {
    const sub = await db.getAsync(`SELECT * FROM template_submissions WHERE id = ?`, [req.params.id]);
    if (!sub || sub.status !== 'pending') {
      return res.status(400).json({ error: 'Invalid submission or already processed' });
    }

    let baseSlug = slugify(sub.proposed_name);
    let slug = baseSlug;
    let n = 0;
    // eslint-disable-next-line no-await-in-loop
    while (await db.getAsync(`SELECT id FROM published_system_templates WHERE slug = ?`, [slug])) {
      n += 1;
      slug = `${baseSlug}-${n}`;
    }

    const pubId = generateId();

    await db.runAsync(
      `INSERT INTO published_system_templates (
        id, submission_id, slug, name, description, category, icon, canvas_data,
        source_build_id, submitted_by_user_id, approved_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pubId,
        sub.id,
        slug,
        sub.proposed_name,
        sub.proposed_description || '',
        sub.proposed_category || 'enterprise',
        sub.proposed_icon || '📋',
        sub.canvas_snapshot,
        sub.build_id,
        sub.submitter_user_id,
        req.user.user_id,
      ]
    );

    await db.runAsync(
      `UPDATE template_submissions SET status = 'approved', reviewer_user_id = ?, reviewed_at = datetime('now'), published_public_id = ? WHERE id = ?`,
      [req.user.user_id, pubId, sub.id]
    );

    res.json({ ok: true, publishedId: pubId, slug });
  } catch (err) {
    console.error('[Admin] Approve template error:', err);
    res.status(500).json({ error: 'Failed to approve submission' });
  }
});

router.post('/template-submissions/:id/reject', requireSuperAdmin, async (req, res) => {
  try {
    const { reason = '' } = req.body;
    const sub = await db.getAsync(`SELECT * FROM template_submissions WHERE id = ?`, [req.params.id]);
    if (!sub || sub.status !== 'pending') {
      return res.status(400).json({ error: 'Invalid submission or already processed' });
    }

    await db.runAsync(
      `UPDATE template_submissions SET status = 'rejected', reviewer_user_id = ?, reviewed_at = datetime('now'), rejection_reason = ? WHERE id = ?`,
      [req.user.user_id, String(reason).trim().slice(0, 2000), sub.id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[Admin] Reject template error:', err);
    res.status(500).json({ error: 'Failed to reject submission' });
  }
});

module.exports = router;
