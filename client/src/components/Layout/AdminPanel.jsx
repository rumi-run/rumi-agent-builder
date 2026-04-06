import React, { useState, useEffect, useCallback } from 'react';
import { adminApi, adminTemplateApi } from '../../utils/api';
import useAuthStore from '../../stores/authStore';

export default function AdminPanel() {
  const { capabilities } = useAuthStore();
  const isSuperAdmin = !!capabilities?.isSuperAdmin;
  const [aiConfig, setAiConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    apiProvider: 'apimart',
    apiEndpoint: '',
    apiKey: '',
    defaultModel: 'claude-opus-4-6',
    rateLimitPerUser: 50,
    rateLimitWindow: 'day',
    enabled: true,
  });

  // Users state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userPagination, setUserPagination] = useState({ total: 0, totalPages: 0, page: 1, limit: 20 });

  const [tplSubmissions, setTplSubmissions] = useState([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [tplBusyId, setTplBusyId] = useState(null);

  const loadTemplateSubmissions = useCallback(async () => {
    if (!isSuperAdmin) return;
    setTplLoading(true);
    try {
      const data = await adminTemplateApi.listSubmissions('pending');
      setTplSubmissions(data.submissions || []);
    } catch (err) {
      console.error('Failed to load template submissions:', err);
    } finally {
      setTplLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    loadTemplateSubmissions();
  }, [loadTemplateSubmissions]);

  const handleApproveTemplate = async (id) => {
    setTplBusyId(id);
    try {
      await adminTemplateApi.approve(id);
      await loadTemplateSubmissions();
      setRejectingId(null);
      setRejectReasonInput('');
    } catch (err) {
      console.error('Approve template failed:', err);
    } finally {
      setTplBusyId(null);
    }
  };

  const handleRejectTemplate = async (id) => {
    setTplBusyId(id);
    try {
      await adminTemplateApi.reject(id, rejectReasonInput);
      await loadTemplateSubmissions();
      setRejectingId(null);
      setRejectReasonInput('');
    } catch (err) {
      console.error('Reject template failed:', err);
    } finally {
      setTplBusyId(null);
    }
  };

  const loadUsers = useCallback(async (page = 1, search = userSearch) => {
    setUsersLoading(true);
    try {
      const data = await adminApi.getUsers({ page, limit: 20, search });
      setUsers(data.users || []);
      setUserPagination(data.pagination || { total: 0, totalPages: 0, page: 1, limit: 20 });
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setUsersLoading(false);
    }
  }, [userSearch]);

  useEffect(() => {
    loadConfig();
    loadUsers(1, '');
  }, []);

  const loadConfig = async () => {
    try {
      const data = await adminApi.getAiConfig();
      if (data.config) {
        setAiConfig(data.config);
        setForm({ ...form, ...data.config, apiKey: data.config.apiKeySet ? '••••••••••••' : '' });
      }
    } catch (err) {
      console.error('Failed to load AI config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const payload = { ...form };
      if (payload.apiKey === '••••••••••••') delete payload.apiKey;
      await adminApi.updateAiConfig(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save AI config:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-rumi-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-th-primary">Admin Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Configure platform-level AI services and settings</p>
        </div>

        {/* AI Configuration */}
        <div className="rumi-card mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-rumi-purple/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-rumi-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-th-primary">AI Service Configuration</h2>
              <p className="text-xs text-gray-500">Platform-managed AI for instruction generation and structure validation</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-rumi-dark/50">
              <label className="text-xs text-gray-400 shrink-0">Enabled</label>
              <button
                onClick={() => setForm({ ...form, enabled: !form.enabled })}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  form.enabled ? 'bg-rumi-accent' : 'bg-rumi-border'
                }`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  form.enabled ? 'left-[22px]' : 'left-0.5'
                }`} />
              </button>
            </div>

            <div>
              <label className="rumi-label">API Provider</label>
              <select
                className="rumi-input"
                value={form.apiProvider}
                onChange={(e) => setForm({ ...form, apiProvider: e.target.value })}
              >
                <option value="apimart">APIMart</option>
                <option value="anthropic">Anthropic Direct</option>
                <option value="openai">OpenAI Direct</option>
                <option value="custom">Custom Endpoint</option>
              </select>
            </div>

            <div>
              <label className="rumi-label">API Endpoint</label>
              <input
                type="text"
                className="rumi-input font-mono text-xs"
                value={form.apiEndpoint}
                onChange={(e) => setForm({ ...form, apiEndpoint: e.target.value })}
                placeholder="https://api.apimart.com/v1"
              />
            </div>

            <div>
              <label className="rumi-label">API Key</label>
              <input
                type="password"
                className="rumi-input font-mono text-xs"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder="sk-..."
                onFocus={(e) => { if (e.target.value === '••••••••••••') setForm({ ...form, apiKey: '' }); }}
              />
              <p className="text-[10px] text-gray-600 mt-1">Stored encrypted. Powers AI features for all users.</p>
            </div>

            <div>
              <label className="rumi-label">Default Model</label>
              <input
                type="text"
                className="rumi-input"
                value={form.defaultModel}
                onChange={(e) => setForm({ ...form, defaultModel: e.target.value })}
                placeholder="claude-opus-4-6"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="rumi-label">Rate Limit (per user)</label>
                <input
                  type="number"
                  className="rumi-input"
                  value={form.rateLimitPerUser}
                  onChange={(e) => setForm({ ...form, rateLimitPerUser: parseInt(e.target.value) || 50 })}
                  min={1}
                />
              </div>
              <div>
                <label className="rumi-label">Rate Window</label>
                <select
                  className="rumi-input"
                  value={form.rateLimitWindow}
                  onChange={(e) => setForm({ ...form, rateLimitWindow: e.target.value })}
                >
                  <option value="hour">Per Hour</option>
                  <option value="day">Per Day</option>
                  <option value="month">Per Month</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-rumi-border">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rumi-btn-primary text-xs"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
            {saved && (
              <span className="text-green-400 text-xs flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </span>
            )}
          </div>
        </div>

        {/* System template review (super admin) */}
        {isSuperAdmin && (
          <div className="rumi-card mb-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <span className="text-lg" aria-hidden>
                    📋
                  </span>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-th-primary">System template review</h2>
                  <p className="text-xs text-gray-500">
                    Approve user submissions before they appear in the template gallery for everyone.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => loadTemplateSubmissions()}
                className="text-[10px] px-2 py-1 rounded border border-rumi-border text-gray-400 hover:text-th-primary"
              >
                Refresh
              </button>
            </div>

            {tplLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-rumi-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : tplSubmissions.length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-6">No pending template submissions</p>
            ) : (
              <ul className="space-y-3">
                {tplSubmissions.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-lg border border-rumi-border bg-rumi-dark/40 p-3 text-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-th-primary truncate">{s.proposed_name}</p>
                        <p className="text-gray-500 mt-0.5">
                          Agent: {s.build_name || s.build_id}{' '}
                          <span className="text-gray-600">
                            · {s.proposed_category || 'enterprise'} · from {s.submitter_email}
                          </span>
                        </p>
                        {s.proposed_description ? (
                          <p className="text-gray-400 mt-2 line-clamp-3">{s.proposed_description}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {rejectingId === s.id ? (
                          <div className="flex flex-col items-stretch gap-1 w-full min-w-[200px]">
                            <textarea
                              className="rumi-input text-[10px] min-h-[52px]"
                              placeholder="Reason for rejection (optional)"
                              value={rejectReasonInput}
                              onChange={(e) => setRejectReasonInput(e.target.value)}
                            />
                            <div className="flex gap-1 justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingId(null);
                                  setRejectReasonInput('');
                                }}
                                className="px-2 py-1 rounded text-[10px] text-gray-400 hover:text-th-primary"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={tplBusyId === s.id}
                                onClick={() => handleRejectTemplate(s.id)}
                                className="px-2 py-1 rounded text-[10px] bg-red-500/20 text-red-300 border border-red-500/30"
                              >
                                {tplBusyId === s.id ? '…' : 'Confirm reject'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={tplBusyId === s.id}
                              onClick={() => handleApproveTemplate(s.id)}
                              className="px-2 py-1 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-40"
                            >
                              {tplBusyId === s.id ? '…' : 'Approve'}
                            </button>
                            <button
                              type="button"
                              disabled={tplBusyId === s.id}
                              onClick={() => {
                                setRejectingId(s.id);
                                setRejectReasonInput('');
                              }}
                              className="px-2 py-1 rounded text-[10px] bg-red-500/15 text-red-300 border border-red-500/25 hover:bg-red-500/25 disabled:opacity-40"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* User Management */}
        <div className="rumi-card mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-th-primary">Users</h2>
              <p className="text-xs text-gray-500">
                {userPagination.total} total user{userPagination.total !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              className="rumi-input text-xs"
              placeholder="Search by email or name..."
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
                setUserPage(1);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') loadUsers(1, userSearch);
              }}
            />
            <button
              onClick={() => { setUserPage(1); loadUsers(1, userSearch); }}
              className="rumi-btn-secondary text-xs mt-2"
            >
              Search
            </button>
          </div>

          {/* User Table */}
          {usersLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-rumi-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-gray-500 text-xs text-center py-6">No users found</p>
          ) : (
            <div className="overflow-x-auto -mx-1 px-1 rounded-lg" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="border-b border-rumi-border text-gray-400 text-left">
                    <th className="pb-2 pr-3 font-medium">Email</th>
                    <th className="pb-2 pr-3 font-medium">Name</th>
                    <th className="pb-2 pr-3 font-medium">Role</th>
                    <th className="pb-2 pr-3 font-medium">Agents</th>
                    <th className="pb-2 pr-3 font-medium">Joined</th>
                    <th className="pb-2 font-medium">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-rumi-border/50 hover:bg-rumi-dark/30">
                      <td className="py-2 pr-3 text-th-primary font-mono truncate max-w-[200px]">{u.email}</td>
                      <td className="py-2 pr-3 text-gray-300 truncate max-w-[120px]">{u.name || '-'}</td>
                      <td className="py-2 pr-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          u.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-gray-300">{u.agent_count}</td>
                      <td className="py-2 pr-3 text-gray-500">{u.created_at?.split('T')[0] || '-'}</td>
                      <td className="py-2 text-gray-500">{u.last_active?.split('T')[0] || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {userPagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-rumi-border">
              <span className="text-[10px] text-gray-500">
                Page {userPagination.page} of {userPagination.totalPages}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => { const p = userPage - 1; setUserPage(p); loadUsers(p, userSearch); }}
                  disabled={userPagination.page <= 1}
                  className="px-2 py-1 text-[10px] rounded bg-rumi-dark text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                {Array.from({ length: Math.min(5, userPagination.totalPages) }, (_, i) => {
                  let pageNum;
                  if (userPagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (userPagination.page <= 3) {
                    pageNum = i + 1;
                  } else if (userPagination.page >= userPagination.totalPages - 2) {
                    pageNum = userPagination.totalPages - 4 + i;
                  } else {
                    pageNum = userPagination.page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => { setUserPage(pageNum); loadUsers(pageNum, userSearch); }}
                      className={`px-2 py-1 text-[10px] rounded ${
                        pageNum === userPagination.page
                          ? 'bg-rumi-accent text-white'
                          : 'bg-rumi-dark text-gray-400 hover:text-white'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => { const p = userPage + 1; setUserPage(p); loadUsers(p, userSearch); }}
                  disabled={userPagination.page >= userPagination.totalPages}
                  className="px-2 py-1 text-[10px] rounded bg-rumi-dark text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
