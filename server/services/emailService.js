const nodemailer = require('nodemailer');
const crypto = require('crypto');
const settings = require('../config/settings');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const { host, port, user, pass } = settings.smtp;
  if (!host || !user) {
    const err = new Error('SMTP_NOT_CONFIGURED');
    err.code = 'SMTP_NOT_CONFIGURED';
    throw err;
  }
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

async function sendOtpEmail(email, code) {
  const expiryMinutes = settings.auth.otpTtlMinutes;
  const uniqueId = crypto.randomBytes(8).toString('hex');
  let t = null;
  try {
    t = getTransporter();
  } catch (err) {
    if (err && err.code === 'SMTP_NOT_CONFIGURED') {
      console.error('[Email] SMTP is not configured. OTP sending blocked.');
      throw err;
    }
    throw err;
  }

  const text = [
    `Your sign-in verification code is: ${code}`,
    '',
    `This code expires in ${expiryMinutes} minutes.`,
    '',
    'You are receiving this because a sign-in was requested for this email address on RUMI Agent Builder (rumi.run).',
    '',
    'If you did not request this code, no action is needed — your account is secure.',
    '',
    '— RUMI Agent Builder',
    'https://rumi.run/builder',
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="420" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;">
          <tr>
            <td style="padding:32px 32px 0;">
              <span style="font-family:-apple-system,system-ui,'Segoe UI',sans-serif;font-size:18px;font-weight:700;color:#0ea5e9;">RUMI.RUN</span>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0;">
              <p style="font-family:-apple-system,system-ui,'Segoe UI',sans-serif;font-size:15px;color:#334155;line-height:1.5;margin:0 0 20px;">
                Enter the following code to sign in to your account:
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px;">
              <div style="background:#f1f5f9;border-radius:10px;padding:20px;text-align:center;">
                <span style="font-family:'SF Mono',SFMono-Regular,Consolas,'Liberation Mono',monospace;font-size:32px;font-weight:700;letter-spacing:10px;color:#0f172a;">${code}</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 0;">
              <p style="font-family:-apple-system,system-ui,'Segoe UI',sans-serif;font-size:13px;color:#64748b;line-height:1.5;margin:0;">
                This code is valid for ${expiryMinutes} minutes.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px;">
              <p style="font-family:-apple-system,system-ui,'Segoe UI',sans-serif;font-size:13px;color:#94a3b8;line-height:1.5;margin:0;">
                You received this email because a sign-in was requested on
                <a href="https://rumi.run/builder" style="color:#0ea5e9;text-decoration:none;">RUMI Agent Builder</a>.
                If you didn't request this, no action is needed.
              </p>
            </td>
          </tr>
        </table>
        <p style="font-family:-apple-system,system-ui,'Segoe UI',sans-serif;font-size:11px;color:#94a3b8;margin:16px 0 0;text-align:center;">
          RUMI.RUN &middot; <a href="https://rumi.run" style="color:#94a3b8;text-decoration:none;">rumi.run</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  try {
    await t.sendMail({
      from: settings.smtp.from,
      to: email,
      subject: 'Your sign-in code for RUMI Agent Builder',
      text,
      html,
      headers: {
        'X-Entity-Ref-ID': uniqueId,
      },
    });
  } catch (err) {
    if (err && err.code === 'SMTP_NOT_CONFIGURED') {
      throw err;
    }
    console.error('[Email] SMTP error:', err && err.message ? err.message : err);
    throw new Error(`Email send failed: ${err && err.message ? err.message : 'unknown'}`);
  }
}

module.exports = { sendOtpEmail };
