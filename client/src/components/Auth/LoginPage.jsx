import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, error, requestCode, verifyCode, clearError } = useAuthStore();
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
          {step === 'email' ? (
            <form onSubmit={handleEmailSubmit}>
              <label className="rumi-label">Email Address</label>
              <input
                type="email"
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
                onClick={handleBack}
                className="text-gray-500 hover:text-gray-300 text-sm mb-4 flex items-center gap-1 transition-colors"
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
              <p className="text-gray-500 text-xs mb-3 leading-relaxed">
                If you do not see the email within 1–2 minutes, check your <strong>Junk</strong> or{' '}
                <strong>Spam</strong> folder. If it landed there, mark the sender as <strong>Not spam</strong> to
                improve future delivery.
              </p>

              {loginNotice ? (
                <div
                  className="mb-4 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2.5 text-xs leading-relaxed text-sky-100/95 whitespace-pre-line"
                  role="status"
                >
                  {loginNotice}
                </div>
              ) : null}

              <div className="flex gap-3 justify-center mb-4">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={otpRefs[i]}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    className="w-14 h-14 text-center text-2xl font-semibold rumi-input"
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

        <p className="text-gray-600 text-xs text-center mt-6">
          By continuing, you agree to RUMI's terms of service
        </p>
      </div>
    </div>
  );
}
