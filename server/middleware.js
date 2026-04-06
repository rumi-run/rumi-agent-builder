const authService = require('./services/authService');
const { fetchSsoMe } = require('./services/ssoClient');

async function requireAuth(req, res, next) {
  const cookieHeader = req.headers.cookie || '';

  const ssoUser = await fetchSsoMe(cookieHeader);
  if (ssoUser) {
    const local = await authService.ensureLocalUserFromSso(ssoUser);
    if (local) {
      req.user = local;
      return next();
    }
  }

  const sessionId =
    req.cookies?.rumi_session ||
    (req.headers.authorization?.startsWith('Bearer ') && req.headers.authorization.slice(7));

  if (!sessionId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const session = await authService.getSession(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Session expired' });
  }

  req.user = session;
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
