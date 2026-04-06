const settings = require('../config/settings');

/**
 * Optional bridge: if BUILDER_AUTH_BRIDGE_* is set, forward the browser Cookie header to
 * an internal auth service GET /me and use the returned user. Disabled when URL or cookie name is empty.
 * Legacy env aliases: RUMI_SSO_INTERNAL_URL, RUMI_SSO_COOKIE_NAME.
 */
async function fetchBridgedUser(cookieHeader) {
  const base = (settings.authBridge.internalUrl || '').replace(/\/$/, '');
  const name = settings.authBridge.cookieName || '';
  if (!base || !name) return null;
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;
  if (!cookieHeader.includes(`${name}=`)) return null;

  try {
    const res = await fetch(`${base}/me`, {
      headers: { cookie: cookieHeader },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  } catch (err) {
    console.warn('[Builder][AuthBridge] /me request failed:', err.message);
    return null;
  }
}

module.exports = { fetchBridgedUser };
