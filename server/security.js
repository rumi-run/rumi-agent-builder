const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function getAllowedOrigins() {
  const defaults = process.env.NODE_ENV === 'production'
    ? ['https://rumi.run']
    : ['http://localhost:5173', 'http://localhost:3020'];
  const configured = String(process.env.BUILDER_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return [...new Set([...defaults, ...configured])];
}

function isTrustedWriteRequest(req) {
  if (SAFE_METHODS.has(String(req.method || '').toUpperCase())) return true;

  const authorization = String(req.get?.('authorization') || req.headers?.authorization || '');
  if (authorization.startsWith('Bearer ')) return true;

  const setupToken = String(req.get?.('x-setup-token') || req.headers?.['x-setup-token'] || '');
  if (setupToken) return true;

  const origin = String(req.get?.('origin') || req.headers?.origin || '');
  return Boolean(origin && getAllowedOrigins().includes(origin));
}

function requireTrustedOrigin(req, res, next) {
  if (isTrustedWriteRequest(req)) return next();
  return res.status(403).json({ error: 'Untrusted request origin' });
}

module.exports = { getAllowedOrigins, isTrustedWriteRequest, requireTrustedOrigin };
