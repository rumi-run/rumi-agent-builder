const express = require('express');
const {
  computeNeedsSetup,
  verifySetupToken,
  applySetup,
} = require('../services/setupService');

const router = express.Router();

router.get('/status', (req, res) => {
  try {
    const s = computeNeedsSetup();
    res.json({
      needsSetup: s.needsSetup,
      smtpConfigured: s.smtpConfigured,
      adminConfigured: s.adminConfigured,
      checklist: s.checklist,
      setupPath: '/builder/setup',
      hint:
        'Sign-in uses email OTP. Configure SMTP and admin emails first. The setup token is printed at server start or stored in data/.setup_token (or set RUMI_SETUP_TOKEN).',
    });
  } catch (err) {
    console.error('[Setup] status error:', err);
    res.status(500).json({ error: 'Failed to read setup status' });
  }
});

router.post('/apply', (req, res) => {
  try {
    const s = computeNeedsSetup();
    if (!s.needsSetup) {
      return res.status(403).json({
        error:
          'Initial setup is already complete. Edit the server .env file and restart if you need to change core settings.',
      });
    }

    const headerToken = (req.get('x-setup-token') || '').trim();
    const bodyToken = String(req.body && req.body.token ? req.body.token : '').trim();
    const token = headerToken || bodyToken;

    if (!verifySetupToken(token)) {
      return res.status(401).json({
        error:
          'Invalid or missing setup token. Use the value from server logs, data/.setup_token, or RUMI_SETUP_TOKEN in .env.',
      });
    }

    const result = applySetup(req.body || {});
    res.json(result);
  } catch (err) {
    const code = err && err.code;
    if (code === 'VALIDATION') {
      return res.status(400).json({ error: err.message, details: err.details });
    }
    if (code === 'SETUP_ALREADY_COMPLETE') {
      return res.status(403).json({ error: err.message });
    }
    console.error('[Setup] apply error:', err);
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

module.exports = router;
