const authService = require('./services/authService');
const { fetchBridgedUser } = require('./services/externalAuthBridge');
const settings = require('./config/settings');

function superAdminEmailSet() {
  const s = settings.auth.superAdminEmails;
  return s.length ? s : settings.auth.adminEmails;
}

function isSuperAdminEmail(email) {
  if (!email) return false;
  return superAdminEmailSet().includes(String(email).toLowerCase());
}

async function requireAuth(req, res, next) {
  const cookieHeader = req.headers.cookie || '';

  const bridged = await fetchBridgedUser(cookieHeader);
  if (bridged) {
    const local = await authService.ensureLocalUserFromExternalAuth(bridged);
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

function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!isSuperAdminEmail(req.user.email)) {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireSuperAdmin, isSuperAdminEmail, superAdminEmailSet };
