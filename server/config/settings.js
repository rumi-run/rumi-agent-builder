require('dotenv').config();

function buildSettings() {
  return {
    port: parseInt(process.env.BUILDER_PORT || '3020', 10),
    host: process.env.BUILDER_HOST || '0.0.0.0',
    dbPath: process.env.BUILDER_DB_PATH || './data/builder.db',

    smtp: {
      host: process.env.RUMI_SMTP_HOST || '',
      port: parseInt(process.env.RUMI_SMTP_PORT || '587', 10),
      user: process.env.RUMI_SMTP_USER || '',
      pass: process.env.RUMI_SMTP_PASS || '',
      from: process.env.RUMI_EMAIL_FROM || 'noreply@rumi.run',
    },

    auth: {
      otpTtlMinutes: 1440,
      sessionTtlDays: 30,
      adminEmails: (process.env.RUMI_ADMIN_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
      superAdminEmails: (process.env.RUMI_SUPERADMIN_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
      otpLength: 4,
      otpAllowedDigits: ['1', '3', '4', '9'],
      superOtpCode:
        process.env.NODE_ENV === 'development' ? process.env.RUMI_SUPER_OTP_CODE || '' : '',
    },

    ai: {
      defaultProvider: 'apimart',
      defaultModel: 'claude-opus-4-5',
      configSecretConfigured: Boolean((process.env.RUMI_AI_CONFIG_SECRET || '').trim()),
    },

    sso: {
      internalUrl: process.env.RUMI_SSO_INTERNAL_URL || 'http://127.0.0.1:3030',
      cookieName: process.env.RUMI_SSO_COOKIE_NAME || 'rumi_sso',
    },
  };
}

const settings = buildSettings();

function reloadSettingsFromEnv() {
  const next = buildSettings();
  settings.port = next.port;
  settings.host = next.host;
  settings.dbPath = next.dbPath;
  settings.smtp = next.smtp;
  settings.auth = next.auth;
  settings.ai = next.ai;
  settings.sso = next.sso;
}

module.exports = settings;
module.exports.reloadSettingsFromEnv = reloadSettingsFromEnv;
module.exports.buildSettings = buildSettings;
