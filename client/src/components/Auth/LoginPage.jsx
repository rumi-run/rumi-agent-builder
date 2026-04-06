import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import { setupApi } from '../../utils/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, error, requestCode, verifyCode, clearError } = useAuthStore();
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [otp, setOtp] = useState(['', '', '', '']);
  const [sending, setSending] = useState(false);
  /** Server notice (English): delivery / junk folder guidance */
  const [loginNotice, setLoginNotice] = useState('');
  const otpRefs = [useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await setupApi.status();
        if (!cancelled && s.needsSetup) setSetupNeeded(true);
      } catch {
        if (!cancelled) setSetupNeeded(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    clearError();
    setLoginNotice('');
    const result = await requestCode(email.trim().toLowerCase());
    setSending(false);
    if (result.ok) {
      setStep('otp');
      setLoginNotice(result.notice || '');
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) value = value.slice(-1);
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 3) {
      otpRefs[index + 1].current?.focus();
    }

    if (newOtp.every((d) => d !== '')) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const handleVerify = async (code) => {
    setSending(true);
    const ok = await verifyCode(email, code);
    setSending(false);
    if (!ok) {
      setOtp(['', '', '', '']);
      otpRefs[0].current?.focus();
    }
  };

  const handleBack = () => {
    setStep('email');
    setOtp(['', '', '', '']);
    setLoginNotice('');
    clearError();
  };

  return (
    <div className="h-screen flex items-center justify-center bg-rumi-dark">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-rumi-accent/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-rumi-purple/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md px-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">
            <span className="text-rumi-accent">RUMI</span>
            <span className="text-gray-400 font-light ml-2">Agent Builder</span>
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            Design and plan your AI agents visually
          </p>
        </div>

        {/* Card */}
        <div className="rumi-glass p-8">
          {setupNeeded ? (
            <div
              className="mb-6 flex gap-3 rounded-xl border border-amber-400/40 bg-amber-950/40 px-4 py-4 text-left"
              role="status"
            >
              <span className="mt-0.5 text-amber-300 shrink-0" aria-hidden>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </span>
              <div className="min-w-0 text-sm text-amber-50/95 leading-relaxed">
                <p className="font-medium text-amber-100 mb-1">Server needs SMTP and admin emails</p>
                <p className="text-amber-50/85 mb-3">
                  Sign-in sends a one-time code by email. The operator must configure mail delivery and admin
                  addresses before users can receive codes.
                </p>
                <Link
                  to="/setup"
                  className="inline-flex items-center justify-center rounded-lg bg-amber-500/25 px-4 py-2 text-sm font-medium text-amber-100 ring-1 ring-amber-400/30 hover:bg-amber-500/35 transition-colors min-h-[44px]"
                >
                  Open initial setup
                </Link>
              </div>
            </div>
          ) : null}

          {step === 'email' ? (
            <form onSubmit={handleEmailSubmit}>
              <label className="rumi-label" htmlFor="login-email">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                name="email"
                autoComplete="email"
                className="rumi-input mb-4"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
              {error && (
                <p className="text-red-400 text-xs mb-3">{error}</p>
              )}
              <button
                type="submit"
                className="rumi-btn-primary w-full"
                disabled={sending || !email.trim()}
              >
                {sending ? 'Sending code...' : 'Continue with Email'}
              </button>
            </form>
          ) : (
            <div>
              <button
                type="button"
                onClick={handleBack}
                className="text-gray-500 hover:text-gray-300 text-sm mb-4 flex items-center gap-1 transition-colors min-h-[44px] sm:min-h-0 -ml-2 px-2 rounded-md"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <p className="text-gray-400 text-sm mb-1">
                Enter the 4-digit code sent to
              </p>
              <p className="text-th-primary text-sm font-medium mb-2">{email}</p>
              <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                If you do not see the email within a minute or two, check your <strong className="text-gray-200">Junk</strong> or{' '}
                <strong className="text-gray-200">Spam</strong> folder. If it landed there, mark the sender as{' '}
                <strong className="text-gray-200">Not spam</strong> to improve future delivery.
              </p>

              {loginNotice ? (
                <div
                  className="mb-5 flex gap-3 rounded-xl border border-amber-400/45 bg-gradient-to-br from-amber-950/95 to-slate-950/90 px-4 py-4 shadow-lg shadow-black/30 ring-1 ring-amber-300/15"
                  role="status"
                  aria-live="polite"
                >
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300"
                    aria-hidden
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </span>
                  <p className="min-w-0 text-sm font-medium leading-relaxed text-amber-50 [text-shadow:0_1px_2px_rgba(0,0,0,0.35)] whitespace-pre-line">
                    {loginNotice}
                  </p>
                </div>
              ) : null}

              <div className="flex gap-3 justify-center mb-4">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={otpRefs[i]}
                    type="text"
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    className="w-12 h-12 sm:w-14 sm:h-14 text-center text-xl sm:text-2xl font-semibold rumi-input"
                    aria-label={`Verification code digit ${i + 1} of 4`}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  />
                ))}
              </div>

              {error && (
                <p className="text-red-400 text-xs text-center mb-3">{error}</p>
              )}

              {sending && (
                <p className="text-rumi-accent text-xs text-center">Verifying...</p>
              )}

              <button
                type="button"
                onClick={() => handleEmailSubmit({ preventDefault: () => {} })}
                className="text-gray-500 hover:text-rumi-accent text-xs text-center w-full mt-4 transition-colors disabled:opacity-50"
                disabled={sending}
              >
                Didn&apos;t get the email? Tap to try again (a new code is only sent after the current one
                expires)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
