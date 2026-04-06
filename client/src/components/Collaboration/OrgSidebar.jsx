import React, { useEffect, useState } from 'react';
import { orgApi } from '../../utils/api';

export default function OrgSidebar({ onSelectOrg, selectedOrgId, onCreateOrg }) {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadOrgs();
  }, []);

  const loadOrgs = async () => {
    try {
      const data = await orgApi.list();
      setOrgs(data.orgs || []);
    } catch (err) {
      console.error('Failed to load orgs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const data = await orgApi.create({ name: newName.trim() });
      setOrgs((prev) => [...prev, { ...data.org, member_count: 1, agent_count: 0 }]);
      setNewName('');
      setShowCreate(false);
      onCreateOrg?.(data.org);
    } catch (err) {
      console.error('Failed to create org:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="border-t border-rumi-border pt-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-th-muted uppercase tracking-wider">Teams</h3>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="text-gray-600 hover:text-gray-400 transition-colors"
          title="Create team"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-3 flex gap-1.5">
          <input
            type="text"
            className="rumi-input text-xs flex-1"
            placeholder="Team name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <button type="submit" disabled={creating} className="rumi-btn-primary text-xs px-2">
            {creating ? '...' : 'Add'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="py-2">
          <div className="h-6 bg-rumi-border/30 rounded animate-pulse mb-1.5" />
          <div className="h-6 bg-rumi-border/30 rounded animate-pulse" />
        </div>
      ) : orgs.length === 0 ? (
        <p className="text-gray-600 text-[10px]">No teams yet</p>
      ) : (
        <div className="space-y-0.5">
          {orgs.map((org) => (
            <button
              key={org.id}
              onClick={() => onSelectOrg(org.id)}
              className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center justify-between ${
                selectedOrgId === org.id
                  ? 'bg-rumi-accent/10 text-rumi-accent'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="truncate">{org.name}</span>
              </div>
              <span className="text-[9px] text-gray-600">{org.agent_count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
