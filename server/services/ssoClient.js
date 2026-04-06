const settings = require('../config/settings');

/**
 * 用原始 Cookie 头调用本机 rumi-unified-auth 的 /me（仅服务端，不对外暴露 3030）
 */
async function fetchSsoMe(cookieHeader) {
  const base = settings.sso.internalUrl.replace(/\/$/, '');
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;
  const name = settings.sso.cookieName;
  if (!cookieHeader.includes(`${name}=`)) return null;

  try {
    const res = await fetch(`${base}/me`, {
      headers: { cookie: cookieHeader },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  } catch (err) {
    console.warn('[Builder][SSO] /me 请求失败:', err.message);
    return null;
  }
}

module.exports = { fetchSsoMe };
