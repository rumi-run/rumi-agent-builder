const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const emailService = require('../services/emailService');
const { requireAuth, isSuperAdminEmail } = require('../middleware');

// Request OTP
router.post('/request-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    const code = await authService.createLoginCode(
      email,
      req.ip,
      req.get('user-agent')
    );

    await emailService.sendOtpEmail(email, code);
    res.json({ ok: true, message: 'Code sent' });
  } catch (err) {
    console.error('[Auth] Request code error:', err);
    const msg = err && err.message ? String(err.message) : '';
    if (msg.includes('SMTP_NOT_CONFIGURED')) {
      return res.status(503).json({
        error: '邮件服务未配置，暂时无法发送验证码，请联系管理员。',
      });
    }
    if (msg.includes('Email send failed')) {
      return res.status(503).json({
        error: '邮件发送失败，请稍后重试或联系管理员检查 SMTP 配置。',
      });
    }
    res.status(500).json({ error: 'Failed to send code' });
  }
});

// Verify OTP
router.post('/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code required' });
    }

    const valid = await authService.verifyLoginCode(email, code);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid or expired code' });
    }

    const user = await authService.getOrCreateUser(email);
    const sessionId = await authService.createSession(
      user.id,
      email,
      user.role,
      req.ip,
      req.get('user-agent')
    );

    res.cookie('rumi_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    });

    res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        org: user.org,
      },
    });
  } catch (err) {
    console.error('[Auth] Verify code error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Check session
router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.user_id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      org: req.user.org,
    },
  });
});

// Builder capabilities (for UI: super admin template approvals, etc.)
router.get('/capabilities', requireAuth, (req, res) => {
  res.json({
    isAdmin: req.user.role === 'admin',
    isSuperAdmin: isSuperAdminEmail(req.user.email),
  });
});

// Logout
router.post('/logout', async (req, res) => {
  const sessionId = req.cookies?.rumi_session;
  if (sessionId) {
    await authService.deleteSession(sessionId);
  }
  res.clearCookie('rumi_session', { path: '/' });
  res.json({ ok: true });
});

// Update profile
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, org } = req.body;
    await authService.updateUserProfile(req.user.user_id, { name, org });
    const user = await authService.getOrCreateUser(req.user.email);
    res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        org: user.org,
      },
    });
  } catch (err) {
    console.error('[Auth] Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
