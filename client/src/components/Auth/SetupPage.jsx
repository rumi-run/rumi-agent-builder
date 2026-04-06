import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { setupApi } from '../../utils/api';

export default function SetupPage() {
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(true);
  const [checklist, setChecklist] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const [token, setToken] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [emailFrom, setEmailFrom] = useState('noreply@rumi.run');
  const [adminEmails, setAdminEmails] = useState('');
  const [superAdminEmails, setSuperAdminEmails] = useState('');
  const [aiConfigSecret, setAiConfigSecret] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await setupApi.status();
        if (cancelled) return;
        setNeedsSetup(!!s.needsSetup);
        setChecklist(s.checklist || []);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load setup status');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await setupApi.apply(
        {
          token: token.trim(),
          smtpHost: smtpHost.trim(),
          smtpPort: parseInt(smtpPort, 10) || 587,
          smtpUser: smtpUser.trim(),
          smtpPass,
          emailFrom: emailFrom.trim() || 'noreply@rumi.run',
          adminEmails: adminEmails.trim(),
          superAdminEmails: superAdminEmails.trim(),
          aiConfigSecret: aiConfigSecret.trim(),
        },
        token.trim()
      );
      setSuccess(true);
      setNeedsSetup(false);
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-rumi-dark">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-rumi-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading setup…</p>
        </div>
      </div>
    );
  }

  if (!needsSetup && !success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rumi-dark px-4 py-12">
        <div className="relative w-full max-w-lg">
          <div className="rumi-glass p-8 text-center">
            <h1 className="text-xl font-semibold text-th-primary mb-2">Core settings already saved</h1>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              SMTP and admin emails are present in the server environment. To change them, edit the server{' '}
              <code className="text-rumi-accent text-xs">.env</code> file and restart the process.
            </p>
            <Link to="/login" className="rumi-btn-primary inline-block px-6 py-2.5 rounded-lg">
              Go to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-rumi-dark px-4 py-10">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-rumi-accent/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">
            <span className="text-rumi-accent">RUMI</span>
            <span className="text-gray-400 font-light ml-2">Initial setup</span>
          </h1>
          <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto leading-relaxed">
            Email sign-in uses one-time codes. Configure SMTP and which addresses become admins before anyone
            signs in. Paste the setup token from the server log or{' '}
            <code className="text-xs text-gray-400">data/.setup_token</code> (or{' '}
            <code className="text-xs text-gray-400">RUMI_SETUP_TOKEN</code> in <code className="text-xs text-gray-400">.env</code>
            ).
          </p>
        </div>

        {success ? (
          <div className="rumi-glass p-8 text-center">
            <p className="text-th-primary font-medium mb-2">Settings saved to the server .env file.</p>
            <p className="text-gray-400 text-sm mb-6">
              You can sign in with an address listed under Admin emails. If the server runs behind a process
              manager, restart it so every worker picks up the file (this Node process already reloaded values).
            </p>
            <Link to="/login" className="rumi-btn-primary inline-block px-6 py-2.5 rounded-lg">
              Continue to sign in
            </Link>
          </div>
        ) : (
          <form className="rumi-glass p-8 space-y-5" onSubmit={handleSubmit}>
            {checklist.length > 0 && (
              <ul className="text-xs text-gray-500 space-y-1 border border-white/10 rounded-lg p-3 bg-white/[0.02]">
                {checklist.map((c) => (
                  <li key={c.id} className="flex items-start gap-2">
                    <span className={c.ok ? 'text-emerald-400' : 'text-amber-400'}>{c.ok ? '✓' : '○'}</span>
                    <span>{c.label}</span>
                  </li>
                ))}
              </ul>
            )}

            <div>
              <label className="rumi-label" htmlFor="setup-token">
                Setup token
              </label>
              <input
                id="setup-token"
                type="password"
                autoComplete="off"
                className="rumi-input"
                placeholder="Paste one-time token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="rumi-label" htmlFor="smtp-host">
                  SMTP host
                </label>
                <input
                  id="smtp-host"
                  className="rumi-input"
                  placeholder="smtp.example.com"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="rumi-label" htmlFor="smtp-port">
                  Port
                </label>
                <input
                  id="smtp-port"
                  type="number"
                  className="rumi-input"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="rumi-label" htmlFor="smtp-user">
                SMTP username
              </label>
              <input
                id="smtp-user"
                className="rumi-input"
                autoComplete="off"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="rumi-label" htmlFor="smtp-pass">
                SMTP password
              </label>
              <input
                id="smtp-pass"
                type="password"
                className="rumi-input"
                autoComplete="new-password"
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
              />
              <p className="text-gray-500 text-xs mt-1">Use an app password for providers that require it.</p>
            </div>

            <div>
              <label className="rumi-label" htmlFor="email-from">
                From address
              </label>
              <input
                id="email-from"
                type="email"
                className="rumi-input"
                value={emailFrom}
                onChange={(e) => setEmailFrom(e.target.value)}
              />
            </div>

            <div>
              <label className="rumi-label" htmlFor="admin-emails">
                Admin emails
              </label>
              <input
                id="admin-emails"
                className="rumi-input"
                placeholder="you@company.com, ops@company.com"
                value={adminEmails}
                onChange={(e) => setAdminEmails(e.target.value)}
                required
              />
              <p className="text-gray-500 text-xs mt-1">
                Comma-separated. First sign-in with one of these addresses receives the admin role.
              </p>
            </div>

            <div>
              <label className="rumi-label" htmlFor="super-emails">
                Super admin emails (optional)
              </label>
              <input
                id="super-emails"
                className="rumi-input"
                placeholder="Leave empty to reuse admin list for template approvals"
                value={superAdminEmails}
                onChange={(e) => setSuperAdminEmails(e.target.value)}
              />
            </div>

            <div>
              <label className="rumi-label" htmlFor="ai-secret">
                RUMI_AI_CONFIG_SECRET (optional)
              </label>
              <input
                id="ai-secret"
                type="password"
                className="rumi-input"
                autoComplete="off"
                placeholder="Long random string for encrypting admin AI API keys at rest (recommended in production)"
                value={aiConfigSecret}
                onChange={(e) => setAiConfigSecret(e.target.value)}
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button type="submit" className="rumi-btn-primary w-full" disabled={saving}>
              {saving ? 'Saving…' : 'Save core settings'}
            </button>

            <p className="text-center text-xs text-gray-500">
              <Link to="/login" className="text-rumi-accent hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
