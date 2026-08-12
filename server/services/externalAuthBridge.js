const settings = require('../config/settings');

const COOKIE_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

function getCookieValue(cookieHeader, cookieName) {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;
  if (!COOKIE_NAME_PATTERN.test(cookieName)) return null;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    if (name === cookieName) return part.slice(separator + 1).trim();
  }

  return null;
}

function getBridgeUrl(base) {
  try {
    const url = new URL(`${base.replace(/\/$/, '')}/me`);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Optional bridge: if BUILDER_AUTH_BRIDGE_* is set, forward the browser Cookie header to
 * an internal auth service GET /me and use the returned user. Disabled when URL or cookie name is empty.
 * Legacy env aliases: RUMI_SSO_INTERNAL_URL, RUMI_SSO_COOKIE_NAME.
 */
async function fetchBridgedUser(cookieHeader) {
  const base = (settings.authBridge.internalUrl || '').replace(/\/$/, '');
  const name = settings.authBridge.cookieName || '';
  if (!base || !name) return null;
  const value = getCookieValue(cookieHeader, name);
  const bridgeUrl = getBridgeUrl(base);
  if (value === null || !bridgeUrl) return null;

  try {
    const res = await fetch(bridgeUrl, {
      headers: { cookie: `${name}=${value}` },
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  } catch (err) {
    console.warn('[Builder][AuthBridge] /me request failed:', err.message);
    return null;
  }
}

module.exports = { fetchBridgedUser, getCookieValue, getBridgeUrl };
