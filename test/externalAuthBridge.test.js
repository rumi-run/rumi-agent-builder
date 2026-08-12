const test = require('node:test');
const assert = require('node:assert/strict');

const settings = require('../server/config/settings');
const {
  fetchBridgedUser,
  getBridgeUrl,
  getCookieValue,
} = require('../server/services/externalAuthBridge');

test('getCookieValue matches the configured cookie name exactly', () => {
  const header = 'other_session=secret; rumi_session=expected%3Dvalue; suffix_rumi_session=wrong';
  assert.equal(getCookieValue(header, 'rumi_session'), 'expected%3Dvalue');
  assert.equal(getCookieValue(header, 'session'), null);
  assert.equal(getCookieValue(header, 'bad name'), null);
});

test('getBridgeUrl accepts only credential-free HTTP(S) URLs', () => {
  assert.equal(getBridgeUrl('http://127.0.0.1:3030').href, 'http://127.0.0.1:3030/me');
  assert.equal(getBridgeUrl('https://auth.example.com/base/').href, 'https://auth.example.com/base/me');
  assert.equal(getBridgeUrl('file:///tmp/auth'), null);
  assert.equal(getBridgeUrl('https://user:pass@example.com'), null);
  assert.equal(getBridgeUrl('not a url'), null);
});

test('fetchBridgedUser forwards only the configured cookie and rejects redirects', async (t) => {
  const originalBridge = { ...settings.authBridge };
  const originalFetch = global.fetch;
  t.after(() => {
    settings.authBridge = originalBridge;
    global.fetch = originalFetch;
  });

  settings.authBridge = {
    internalUrl: 'https://auth.example.com/internal',
    cookieName: 'bridge_session',
  };

  let request;
  global.fetch = async (url, options) => {
    request = { url: String(url), options };
    return {
      ok: true,
      async json() {
        return { user: { id: 'user-1', email: 'maintainer@example.com' } };
      },
    };
  };

  const user = await fetchBridgedUser('analytics=private; bridge_session=allowed; admin=secret');
  assert.equal(user.email, 'maintainer@example.com');
  assert.equal(request.url, 'https://auth.example.com/internal/me');
  assert.deepEqual(request.options.headers, { cookie: 'bridge_session=allowed' });
  assert.equal(request.options.redirect, 'error');
  assert.ok(request.options.signal instanceof AbortSignal);
});

test('fetchBridgedUser does not call the bridge without an exact cookie match', async (t) => {
  const originalBridge = { ...settings.authBridge };
  const originalFetch = global.fetch;
  t.after(() => {
    settings.authBridge = originalBridge;
    global.fetch = originalFetch;
  });

  settings.authBridge = {
    internalUrl: 'https://auth.example.com',
    cookieName: 'bridge_session',
  };
  global.fetch = async () => {
    assert.fail('fetch must not be called');
  };

  assert.equal(await fetchBridgedUser('not_bridge_session=value'), null);
});
