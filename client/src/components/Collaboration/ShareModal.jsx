import React, { useState, useEffect, useId } from 'react';
import { sharingApi, communityTemplatesApi } from '../../utils/api';
import { userFacingError } from '../../utils/userFacingError';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { TEMPLATE_CATEGORIES } from '../../utils/templates';

const CATEGORY_KEYS = Object.keys(TEMPLATE_CATEGORIES).filter((k) => k !== 'basic');

export default function ShareModal({ buildId, buildName = '', buildDescription = '', onClose }) {
  const titleId = useId();
  const dialogRef = useDialogFocus(true, onClose);
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState('view');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(null);
  const [error, setError] = useState('');

  const [tplName, setTplName] = useState(buildName || '');
  const [tplDesc, setTplDesc] = useState(buildDescription || '');
  const [tplCategory, setTplCategory] = useState('enterprise');
  const [tplIcon, setTplIcon] = useState('📋');
  const [tplSubmitting, setTplSubmitting] = useState(false);
  const [tplError, setTplError] = useState('');
  const [tplSuccess, setTplSuccess] = useState('');
  const [submission, setSubmission] = useState(null);

  useEffect(() => {
    loadShares();
  }, [buildId]);

  useEffect(() => {
    setTplName(buildName || '');
    setTplDesc(buildDescription || '');
  }, [buildName, buildDescription]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await communityTemplatesApi.getStatus(buildId);
        if (!cancelled) setSubmission(data.submission || null);
      } catch {
        if (!cancelled) setSubmission(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buildId, tplSuccess]);

  const loadShares = async () => {
    try {
      const data = await sharingApi.listShares(buildId);
      setShares(data.shares || []);
    } catch (err) {
      console.error('Failed to load shares:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const data = await sharingApi.createShare(buildId, {
        permission,
        email: email.trim() || undefined,
      });
      setShares((prev) => [data.share, ...prev]);
      setEmail('');
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (shareId) => {
    try {
      await sharingApi.revokeShare(shareId);
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    } catch (err) {
      console.error('Failed to revoke:', err);
    }
  };

  const copyLink = (token) => {
    const url = `${window.location.origin}/builder/shared/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSubmitTemplate = async (e) => {
    e.preventDefault();
    setTplSubmitting(true);
    setTplError('');
    setTplSuccess('');
    try {
      await communityTemplatesApi.submit({
        buildId,
        proposedName: tplName.trim(),
        proposedDescription: tplDesc.trim(),
        proposedCategory: tplCategory,
        proposedIcon: tplIcon.trim() || '📋',
      });
      setTplSuccess('Submitted for review. A super admin must approve before it appears in the template gallery.');
      const data = await communityTemplatesApi.getStatus(buildId);
      setSubmission(data.submission || null);
    } catch (err) {
      setTplError(userFacingError(err, 'Submission failed'));
    } finally {
      setTplSubmitting(false);
    }
  };

  const pending = submission?.status === 'pending';
  const approved = submission?.status === 'approved';
  const rejected = submission?.status === 'rejected';
  const proposedLabel = submission?.proposed_name || submission?.proposedName;
  const rejectReason = submission?.rejection_reason || submission?.rejectionReason;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 pb-[max(0px,env(safe-area-inset-bottom))]"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-rumi-shell border border-rumi-border rounded-t-2xl sm:rounded-xl w-full max-w-lg max-h-[min(92vh,920px)] sm:max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-rumi-border gap-3">
          <h2 id={titleId} className="text-base font-semibold text-th-primary">
            Share Agent
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rumi-touch-sm text-gray-500 hover:text-gray-300 transition-colors rounded-lg sm:min-h-0 sm:min-w-0 p-2 -mr-1"
            aria-label="Close dialog"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Create share form */}
        <form onSubmit={handleCreate} className="px-5 py-4 border-b border-rumi-border">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-2">
            <div className="flex-1 min-w-0">
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">
                Email (optional, leave blank for public link)
              </label>
              <input
                type="email"
                className="rumi-input text-sm"
                placeholder="teammate@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="w-full sm:w-24 shrink-0">
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Access</label>
              <select
                className="rumi-input text-sm"
                value={permission}
                onChange={(e) => setPermission(e.target.value)}
              >
                <option value="view">View</option>
                <option value="edit">Edit</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="rumi-btn-primary text-xs h-11 sm:h-[38px] px-4 w-full sm:w-auto shrink-0"
            >
              {creating ? '...' : 'Share'}
            </button>
          </div>
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </form>

        {/* System template submission */}
        <div className="px-5 py-4 border-b border-rumi-border bg-rumi-dark/20">
          <h3 className="text-xs font-semibold text-th-primary uppercase tracking-wider mb-1">System template</h3>
          <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
            Offer this design as a default template for all users. A super admin must approve it before it goes
            public in the template gallery.
          </p>

          {submission && (
            <div
              className={`mb-3 rounded-lg border px-3 py-2.5 text-xs ${
                pending
                  ? 'border-amber-500/40 bg-amber-950/40 text-amber-100'
                  : approved
                    ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-100'
                    : 'border-red-500/30 bg-red-950/20 text-red-200'
              }`}
            >
              {pending && <p className="font-medium">Pending review</p>}
              {approved && <p className="font-medium">Approved and published to the template gallery.</p>}
              {rejected && (
                <p>
                  <span className="font-medium">Rejected.</span>{' '}
                  {rejectReason ? (
                    <span className="opacity-90">{rejectReason}</span>
                  ) : (
                    <span className="opacity-75">No reason provided.</span>
                  )}
                </p>
              )}
              {proposedLabel && (
                <p className="text-[10px] mt-1 opacity-75">Submission: {proposedLabel}</p>
              )}
            </div>
          )}

          {tplSuccess && (
            <p className="text-xs text-emerald-400/95 mb-2 whitespace-pre-line">{tplSuccess}</p>
          )}
          {tplError && <p className="text-red-400 text-xs mb-2">{tplError}</p>}

          {!pending && !approved && (
            <form onSubmit={handleSubmitTemplate} className="space-y-2">
              <div>
                <label className="block text-[10px] text-gray-500 uppercase mb-0.5">Template title</label>
                <input
                  className="rumi-input text-sm w-full"
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder="e.g. Sales discovery agent"
                  minLength={3}
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase mb-0.5">Short description</label>
                <textarea
                  className="rumi-input text-sm w-full min-h-[56px] resize-y"
                  value={tplDesc}
                  onChange={(e) => setTplDesc(e.target.value)}
                  placeholder="What is this template for?"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-500 uppercase mb-0.5">Category</label>
                  <select
                    className="rumi-input text-sm w-full"
                    value={tplCategory}
                    onChange={(e) => setTplCategory(e.target.value)}
                  >
                    {CATEGORY_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {TEMPLATE_CATEGORIES[key]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-20">
                  <label className="block text-[10px] text-gray-500 uppercase mb-0.5">Icon</label>
                  <input
                    className="rumi-input text-sm w-full text-center"
                    value={tplIcon}
                    onChange={(e) => setTplIcon(e.target.value.slice(0, 8))}
                    placeholder="📋"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={tplSubmitting || !tplName.trim() || tplName.trim().length < 3}
                className="w-full py-2 rounded-lg text-xs font-medium bg-rumi-purple/20 text-rumi-purple border border-rumi-purple/30 hover:bg-rumi-purple/30 transition-colors disabled:opacity-40"
              >
                {tplSubmitting ? 'Submitting…' : 'Submit for system template review'}
              </button>
            </form>
          )}

          {pending && (
            <p className="text-[11px] text-gray-500 mt-2">
              You can still edit this agent. The submitted snapshot was captured when you submitted (resubmit after
              rejection to send an updated snapshot).
            </p>
          )}
        </div>

        {/* Existing shares */}
        <div className="px-5 py-4 max-h-64 overflow-y-auto">
          {loading ? (
            <div className="text-center py-6">
              <div className="w-5 h-5 border-2 border-rumi-accent border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : shares.length === 0 ? (
            <p className="text-gray-600 text-xs text-center py-4">No active share links</p>
          ) : (
            <div className="space-y-2">
              {shares.map((share) => (
                <div key={share.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-rumi-dark/50 border border-rumi-border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          share.permission === 'edit'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-gray-500/10 text-gray-400'
                        }`}
                      >
                        {share.permission}
                      </span>
                      {share.shared_with_email ? (
                        <span className="text-xs text-gray-300 truncate">{share.shared_with_email}</span>
                      ) : (
                        <span className="text-xs text-gray-500">Public link</span>
                      )}
                    </div>
                    {share.expires_at && (
                      <p className="text-[10px] text-gray-600 mt-0.5">
                        Expires {new Date(share.expires_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      type="button"
                      onClick={() => copyLink(share.share_token)}
                      className="text-gray-500 hover:text-gray-300 text-xs px-2 py-2 sm:py-1 rounded hover:bg-white/5 transition-colors min-h-[44px] sm:min-h-0"
                    >
                      {copied === share.share_token ? 'Copied!' : 'Copy link'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRevoke(share.id)}
                      className="text-gray-500 hover:text-red-400 text-xs px-2 py-2 sm:py-1 rounded hover:bg-white/5 transition-colors min-h-[44px] sm:min-h-0"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
