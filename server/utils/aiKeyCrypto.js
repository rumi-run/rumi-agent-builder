const crypto = require('crypto');

const PREFIX = 'enc:v1:';
const SALT = 'rumi-agent-builder-ai-config-v1';
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

function getSecretRaw() {
  return (process.env.RUMI_AI_CONFIG_SECRET || '').trim();
}

function deriveKey(secret) {
  return crypto.scryptSync(secret, SALT, KEY_LEN);
}

/**
 * @returns {string} ciphertext with PREFIX, or legacy-compatible storage
 */
function encryptApiKey(plain) {
  if (plain == null || plain === '') return '';
  const secret = getSecretRaw();
  if (!secret) {
    throw new Error('RUMI_AI_CONFIG_SECRET is not set');
  }
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, enc, tag]);
  return PREFIX + payload.toString('base64');
}

/**
 * @param {string} stored DB value (encrypted or legacy plaintext)
 * @returns {string} plaintext API key for HTTP headers
 */
function decryptApiKey(stored) {
  if (stored == null || stored === '') return '';
  const s = String(stored);
  if (!s.startsWith(PREFIX)) {
    return s;
  }
  const secret = getSecretRaw();
  if (!secret) {
    console.error('[aiKeyCrypto] Encrypted API key in DB but RUMI_AI_CONFIG_SECRET is missing');
    return '';
  }
  const raw = Buffer.from(s.slice(PREFIX.length), 'base64');
  if (raw.length < IV_LEN + TAG_LEN) {
    console.error('[aiKeyCrypto] Invalid ciphertext length');
    return '';
  }
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(raw.length - TAG_LEN);
  const data = raw.subarray(IV_LEN, raw.length - TAG_LEN);
  const key = deriveKey(secret);
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch (e) {
    console.error('[aiKeyCrypto] Decrypt failed:', e.message);
    return '';
  }
}

function isSecretConfigured() {
  return getSecretRaw().length > 0;
}

/**
 * Store admin-submitted key: encrypt when secret exists; dev fallback plaintext with loud log.
 * Production without secret rejects non-empty keys.
 */
function encryptApiKeyForStorage(plain, options = {}) {
  const { isProduction = process.env.NODE_ENV === 'production' } = options;
  if (plain == null || plain === '') return '';

  if (!isSecretConfigured()) {
    if (isProduction) {
      const err = new Error(
        'Cannot store AI API key: set RUMI_AI_CONFIG_SECRET in the server environment (at least 32 characters recommended).'
      );
      err.code = 'MISSING_AI_CONFIG_SECRET';
      throw err;
    }
    console.error(
      '[aiKeyCrypto] RUMI_AI_CONFIG_SECRET is not set; storing API key as plaintext (development only). Do not use in production.'
    );
    return String(plain);
  }

  return encryptApiKey(plain);
}

module.exports = {
  PREFIX,
  encryptApiKey,
  decryptApiKey,
  encryptApiKeyForStorage,
  isSecretConfigured,
};
