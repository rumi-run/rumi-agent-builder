import React, { useState, useEffect } from 'react';
import { sharingApi } from '../../utils/api';

export default function ShareModal({ buildId, onClose }) {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState('view');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadShares();
  }, [buildId]);

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
      setError(err.message);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-rumi-shell border border-rumi-border rounded-xl w-full max-w-lg mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-rumi-border">
          <h2 className="text-base font-semibold text-th-primary">Share Agent</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Create share form */}
        <form onSubmit={handleCreate} className="px-5 py-4 border-b border-rumi-border">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">
                Email (optional — leave blank for public link)
              </label>
              <input
                type="email"
                className="rumi-input text-sm"
                placeholder="teammate@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="w-24">
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
              className="rumi-btn-primary text-xs h-[38px] px-4"
            >
              {creating ? '...' : 'Share'}
            </button>
          </div>
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </form>

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
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        share.permission === 'edit'
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-gray-500/10 text-gray-400'
                      }`}>
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
                      onClick={() => copyLink(share.share_token)}
                      className="text-gray-500 hover:text-gray-300 text-xs px-2 py-1 rounded hover:bg-white/5 transition-colors"
                    >
                      {copied === share.share_token ? 'Copied!' : 'Copy link'}
                    </button>
                    <button
                      onClick={() => handleRevoke(share.id)}
                      className="text-gray-500 hover:text-red-400 text-xs px-2 py-1 rounded hover:bg-white/5 transition-colors"
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
