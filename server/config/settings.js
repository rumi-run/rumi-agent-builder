require('dotenv').config();

module.exports = {
  port: parseInt(process.env.BUILDER_PORT || '3020', 10),
  host: process.env.BUILDER_HOST || '0.0.0.0',
  dbPath: process.env.BUILDER_DB_PATH || './data/builder.db',

  // Email via SMTP (iCloud / standard)
  smtp: {
    host: process.env.RUMI_SMTP_HOST || '',
    port: parseInt(process.env.RUMI_SMTP_PORT || '587', 10),
    user: process.env.RUMI_SMTP_USER || '',
    pass: process.env.RUMI_SMTP_PASS || '',
    from: process.env.RUMI_EMAIL_FROM || 'noreply@beok.net',
  },

  // Auth
  auth: {
    otpTtlMinutes: 1440,
    sessionTtlDays: 30,
    adminEmails: (process.env.RUMI_ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
    otpLength: 4,
    otpAllowedDigits: ['1', '3', '4', '9'],
    // 仅允许在开发环境显式开启应急验证码；生产环境强制关闭
    superOtpCode: process.env.NODE_ENV === 'development'
      ? (process.env.RUMI_SUPER_OTP_CODE || '')
      : '',
  },

  // AI config stored in DB, not env
  ai: {
    defaultProvider: 'apimart',
    defaultModel: 'claude-opus-4-5',
  },

  /** 与 rumi-unified-auth 对接（Cookie rumi_sso） */
  sso: {
    internalUrl: process.env.RUMI_SSO_INTERNAL_URL || 'http://127.0.0.1:3030',
    cookieName: process.env.RUMI_SSO_COOKIE_NAME || 'rumi_sso',
  },
};
