const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware');

router.use(requireAuth);
router.use(requireAdmin);

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
    if (apiKey !== undefined) { updates.push('api_key_encrypted = ?'); values.push(apiKey); } // TODO: encrypt
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

module.exports = router;
