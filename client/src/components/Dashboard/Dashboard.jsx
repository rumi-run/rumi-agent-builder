import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentApi, sharingApi } from '../../utils/api';
import useAuthStore from '../../stores/authStore';
import TemplatesGallery from './TemplatesGallery';
import OrgSidebar from '../Collaboration/OrgSidebar';
import AccessInfoPopover from '../Collaboration/AccessInfoPopover';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [sharedAgents, setSharedAgents] = useState([]);
  const [accessPopover, setAccessPopover] = useState(null); // buildId

  useEffect(() => {
    loadAgents();
    loadSharedAgents();
  }, []);

  const loadSharedAgents = async () => {
    try {
      const data = await sharingApi.sharedWithMe();
      setSharedAgents(data.agents || []);
    } catch (err) {
      // Not critical, ignore
    }
  };

  const loadAgents = async () => {
    try {
      const data = await agentApi.list();
      setAgents(data.agents || []);
    } catch (err) {
      console.error('Failed to load agents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const data = await agentApi.create({ name: 'Untitled Agent' });
      navigate(`/agent/${data.agent.id}`);
    } catch (err) {
      console.error('Failed to create agent:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async (id, e) => {
    e.stopPropagation();
    try {
      const data = await agentApi.duplicate(id);
      setAgents((prev) => [data.agent, ...prev]);
    } catch (err) {
      console.error('Failed to duplicate agent:', err);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      return;
    }
    try {
      await agentApi.delete(id);
      setAgents((prev) => prev.filter((a) => a.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete agent:', err);
    }
  };

  // Merge own agents + shared agents with edit access into a unified list
  const allAgents = [
    ...agents.map((a) => ({ ...a, _access: 'owner' })),
    ...sharedAgents.map((a) => ({ ...a, _access: a.permission, _sharedBy: a.owner_name || a.owner_email, _shareToken: a.share_token })),
  ];

  const filtered = allAgents.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const statusColors = {
    draft: 'bg-yellow-500/10 text-yellow-400',
    ready: 'bg-green-500/10 text-green-400',
    archived: 'bg-gray-500/10 text-gray-400',
  };

  const formatDate = (d) => {
    if (!d) return '';
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-th-primary">My Agents</h1>
            <p className="text-gray-500 text-sm mt-1">
              {agents.length} agent build{agents.length !== 1 ? 's' : ''}
              {sharedAgents.length > 0 && ` · ${sharedAgents.length} shared with you`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTemplates(true)}
              className="rumi-btn-secondary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
              Templates
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="rumi-btn-primary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {creating ? 'Creating...' : 'New Agent'}
            </button>
          </div>
        </div>

        {/* Search */}
        {allAgents.length > 0 && (
          <div className="mb-6">
            <div className="relative max-w-md">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                className="rumi-input pl-10"
                placeholder="Search agents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rumi-card animate-pulse">
                <div className="h-4 bg-rumi-border rounded w-3/4 mb-3" />
                <div className="h-3 bg-rumi-border rounded w-1/2 mb-6" />
                <div className="h-24 bg-rumi-border/50 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && allAgents.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-rumi-accent/10 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-rumi-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-th-primary mb-2">No agents yet</h2>
            <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
              Start building your first AI agent. Drag and drop blocks to design
              the architecture, then export or share with your team.
            </p>
            <div className="flex items-center gap-3 justify-center">
              <button onClick={() => setShowTemplates(true)} className="rumi-btn-secondary">
                Start from Template
              </button>
              <button onClick={handleCreate} disabled={creating} className="rumi-btn-primary">
                Blank Canvas
              </button>
            </div>
          </div>
        )}

        {/* Unified agent grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((agent) => {
              const isShared = agent._access !== 'owner';
              return (
                <div
                  key={`${agent.id}-${agent._access}`}
                  className="rumi-card cursor-pointer group"
                  onClick={() => {
                    if (isShared && agent._access === 'view') {
                      navigate(`/shared/${agent._shareToken}`);
                    } else {
                      navigate(`/agent/${agent.id}`);
                    }
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-semibold text-th-primary truncate group-hover:text-rumi-accent transition-colors">
                          {agent.name}
                        </h3>
                        {/* Collaboration icon for shared agents */}
                        {isShared && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAccessPopover(accessPopover === agent.id ? null : agent.id);
                            }}
                            className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-blue-400 hover:bg-blue-500/10 transition-colors"
                            title="Shared with you"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {isShared ? (
                          <span>by {agent._sharedBy}</span>
                        ) : (
                          formatDate(agent.updated_at)
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isShared && (
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          agent._access === 'edit'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-gray-500/10 text-gray-400'
                        }`}>
                          {agent._access}
                        </span>
                      )}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[agent.status] || statusColors.draft}`}>
                        {agent.status || 'draft'}
                      </span>
                    </div>
                  </div>

                  {/* Access info popover */}
                  {accessPopover === agent.id && (
                    <AccessInfoPopover
                      buildId={agent.id}
                      onClose={() => setAccessPopover(null)}
                    />
                  )}

                  {agent.description && (
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                      {agent.description}
                    </p>
                  )}

                  {/* Mini preview of blocks */}
                  <div className="h-20 bg-rumi-dark/50 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                    {agent.canvas_data?.nodes?.length > 0 ? (
                      <div className="flex flex-wrap gap-1 p-2">
                        {agent.canvas_data.nodes.slice(0, 8).map((node, i) => (
                          <div
                            key={i}
                            className="w-6 h-6 rounded"
                            style={{ backgroundColor: getBlockColor(node.data?.blockType) + '20' }}
                            title={node.data?.name}
                          />
                        ))}
                        {agent.canvas_data.nodes.length > 8 && (
                          <div className="w-6 h-6 rounded bg-gray-600/20 flex items-center justify-center text-[8px] text-gray-500">
                            +{agent.canvas_data.nodes.length - 8}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-600 text-xs">Empty canvas</span>
                    )}
                  </div>

                  {/* Actions — only for owned agents */}
                  {!isShared && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleDuplicate(agent.id, e)}
                        className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
                      >
                        Duplicate
                      </button>
                      <span className="text-gray-700">·</span>
                      <button
                        onClick={(e) => handleDelete(agent.id, e)}
                        className={`text-xs transition-colors ${
                          deleteConfirm === agent.id
                            ? 'text-red-400 font-medium'
                            : 'text-gray-500 hover:text-red-400'
                        }`}
                      >
                        {deleteConfirm === agent.id ? 'Confirm delete?' : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* No search results */}
        {!loading && allAgents.length > 0 && filtered.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-12">
            No agents matching "{search}"
          </p>
        )}

        {/* Teams sidebar */}
        <OrgSidebar
          onSelectOrg={(orgId) => navigate(`/org/${orgId}`)}
          onCreateOrg={(org) => navigate(`/org/${org.id}`)}
        />
      </div>

      {/* Templates modal */}
      {showTemplates && <TemplatesGallery onClose={() => setShowTemplates(false)} />}
    </div>
  );
}

function getBlockColor(type) {
  const colors = {
    llm: '#3b82f6',
    knowledge: '#22c55e',
    instructions: '#a855f7',
    tools: '#f97316',
    memory: '#14b8a6',
    guardrails: '#ef4444',
    input: '#6b7280',
    output: '#374151',
    variable: '#eab308',
    condition: '#ec4899',
    loop: '#06b6d4',
    subagent: '#6366f1',
    connector: '#8b5cf6',
  };
  return colors[type] || '#6b7280';
}
