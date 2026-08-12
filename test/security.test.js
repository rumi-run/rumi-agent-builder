const test = require('node:test');
const assert = require('node:assert/strict');

const { getAllowedOrigins, isTrustedWriteRequest } = require('../server/security');

function request(method, headers = {}) {
  return {
    method,
    headers,
    get(name) {
      return headers[String(name).toLowerCase()];
    },
  };
}

test('safe HTTP methods do not require an origin', () => {
  assert.equal(isTrustedWriteRequest(request('GET')), true);
  assert.equal(isTrustedWriteRequest(request('HEAD')), true);
  assert.equal(isTrustedWriteRequest(request('OPTIONS')), true);
});

test('cookie-authenticated writes require an allowed browser origin', (t) => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAllowed = process.env.BUILDER_ALLOWED_ORIGINS;
  t.after(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalAllowed === undefined) delete process.env.BUILDER_ALLOWED_ORIGINS;
    else process.env.BUILDER_ALLOWED_ORIGINS = originalAllowed;
  });

  process.env.NODE_ENV = 'production';
  process.env.BUILDER_ALLOWED_ORIGINS = 'https://builder.example.com';
  assert.deepEqual(getAllowedOrigins(), ['https://rumi.run', 'https://builder.example.com']);
  assert.equal(isTrustedWriteRequest(request('POST', { origin: 'https://rumi.run' })), true);
  assert.equal(isTrustedWriteRequest(request('PUT', { origin: 'https://builder.example.com' })), true);
  assert.equal(isTrustedWriteRequest(request('DELETE', { origin: 'https://evil.example' })), false);
  assert.equal(isTrustedWriteRequest(request('POST')), false);
});

test('explicit bearer and setup tokens do not rely on ambient cookies', () => {
  assert.equal(isTrustedWriteRequest(request('POST', { authorization: 'Bearer api-session' })), true);
  assert.equal(isTrustedWriteRequest(request('POST', { 'x-setup-token': 'setup-secret' })), true);
});
