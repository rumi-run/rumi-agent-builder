const rateLimit = require('express-rate-limit');

/** Limit OTP request spam (per IP). */
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many code requests from this address. Wait and try again.' },
});

/** Limit OTP verification attempts (per IP). */
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification attempts. Wait and try again.' },
});

module.exports = { otpRequestLimiter, otpVerifyLimiter };
