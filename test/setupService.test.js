const test = require('node:test');
const assert = require('node:assert/strict');

const {
  escapeEnvValue,
  isValidAdminEmail,
  validateSetupPayload,
} = require('../server/services/setupService');

function validSetup(overrides = {}) {
  return {
    smtpHost: 'smtp.example.com',
    smtpPort: 587,
    smtpUser: 'mailer@example.com',
    smtpPass: 'app-password',
    emailFrom: 'RUMI <mailer@example.com>',
    adminEmails: 'admin@example.com',
    superAdminEmails: '',
    aiConfigSecret: 'a'.repeat(64),
    dbPath: './data/builder.db',
    ...overrides,
  };
}

test('validateSetupPayload accepts a normal self-hosted configuration', () => {
  const result = validateSetupPayload(validSetup());
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('isValidAdminEmail uses bounded structural checks', () => {
  assert.equal(isValidAdminEmail('admin@example.com'), true);
  assert.equal(isValidAdminEmail('missing-domain@example'), false);
  assert.equal(isValidAdminEmail('two@@example.com'), false);
  assert.equal(isValidAdminEmail(`${'a'.repeat(245)}@example.com`), false);
});

test('validateSetupPayload rejects newline injection in persisted environment values', () => {
  const result = validateSetupPayload(validSetup({ smtpHost: 'smtp.example.com\nINJECTED=yes' }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /control characters or newlines/);
});

test('validateSetupPayload rejects invalid ports, emails, paths, and short secrets', () => {
  const result = validateSetupPayload(validSetup({
    smtpPort: 70000,
    adminEmails: 'not-an-email',
    aiConfigSecret: 'too-short',
    dbPath: 'data\nbuilder.db',
  }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /SMTP port/);
  assert.match(result.errors.join(' '), /invalid address/);
  assert.match(result.errors.join(' '), /at least 32 characters/);
  assert.match(result.errors.join(' '), /database path/);
});

test('escapeEnvValue quotes spaces and escapes quotes and backslashes', () => {
  assert.equal(escapeEnvValue('plain'), 'plain');
  assert.equal(escapeEnvValue('RUMI Builder <mail@example.com>'), 'RUMI Builder <mail@example.com>');
  assert.equal(escapeEnvValue(' padded '), '" padded "');
  assert.equal(escapeEnvValue('a"b\\c'), '"a\\"b\\\\c"');
});
