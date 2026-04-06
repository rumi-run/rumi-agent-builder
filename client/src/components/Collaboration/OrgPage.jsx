import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { orgApi, agentApi } from '../../utils/api';
import useAuthStore from '../../stores/authStore';

export default function OrgPage() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [org, setOrg] = useState(null);
  const [members, setMembers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [tab, setTab] = useState('agents');

  // Add agent state
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [myAgents, setMyAgents] = useState([]);
  const [loadingMyAgents, setLoadingMyAgents] = useState(false);
  const [addingAgent, setAddingAgent] = useState(null);

  useEffect(() => {
    loadOrg();
    loadAgents();
  }, [orgId]);

  const loadOrg = async () => {
    try {
      const data = await orgApi.get(orgId);
      setOrg(data.org);
      setMembers(data.members || []);
    } catch (err) {
      console.error('Failed to load org:', err);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      const data = await orgApi.listAgents(orgId);
      setAgents(data.agents || []);
    } catch (err) {
      console.error('Failed to load org agents:', err);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError('');
    try {
      await orgApi.invite(orgId, { email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail('');
      loadOrg();
    } catch (err) {
      setInviteError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (userId) => {
    try {
      await orgApi.removeMember(orgId, userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (err) {
      console.error('Failed to remove:', err);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await orgApi.updateRole(orgId, userId, newRole);
      setMembers((prev) =>
        prev.map((m) => m.user_id === userId ? { ...m, role: newRole } : m)
      );
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  const handleOpenAddAgent = async () => {
    setShowAddAgent(true);
    setLoadingMyAgents(true);
    try {
      const data = await agentApi.list();
      // Filter out agents already in this org
      const orgAgentIds = new Set(agents.map((a) => a.id));
      setMyAgents((data.agents || []).filter((a) => !orgAgentIds.has(a.id)));
    } catch (err) {
      console.error('Failed to load my agents:', err);
    } finally {
      setLoadingMyAgents(false);
    }
  };

  const handleMoveAgent = async (buildId) => {
    setAddingAgent(buildId);
    try {
      await orgApi.moveAgent(orgId, buildId);
      setShowAddAgent(false);
      loadAgents(); // Reload org agents
    } catch (err) {
      console.error('Failed to move agent:', err);
    } finally {
      setAddingAgent(null);
    }
  };

  const roleColors = {
    owner: 'bg-yellow-500/10 text-yellow-400',
    admin: 'bg-blue-500/10 text-blue-400',
    member: 'bg-gray-500/10 text-gray-400',
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-rumi-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const canManage = org?.my_role === 'owner' || org?.my_role === 'admin';

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Link to="/" className="text-gray-500 hover:text-gray-300 text-xs">My Agents</Link>
              <span className="text-gray-700">/</span>
            </div>
            <h1 className="text-xl font-bold text-th-primary mt-1">{org?.name}</h1>
            <p className="text-gray-500 text-xs mt-0.5">
              {members.filter((m) => m.joined_at).length} member{members.filter((m) => m.joined_at).length !== 1 ? 's' : ''} · {agents.length} agent{agents.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-rumi-border">
          {['agents', 'members'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-rumi-accent text-rumi-accent'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'agents' ? `Agents (${agents.length})` : `Members (${members.filter((m) => m.joined_at).length})`}
            </button>
          ))}
        </div>

        {/* Agents tab */}
        {tab === 'agents' && (
          <div>
            {/* Add Agent button */}
            {canManage && (
              <div className="mb-4">
                <button
                  onClick={handleOpenAddAgent}
                  className="rumi-btn-secondary text-xs flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Agent to Team
                </button>
              </div>
            )}

            {/* Add agent picker modal */}
            {showAddAgent && (
              <div className="mb-4 p-4 rounded-lg border border-rumi-border bg-rumi-dark/50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-gray-300">Select an agent to add</h4>
                  <button
                    onClick={() => setShowAddAgent(false)}
                    className="text-gray-500 hover:text-white text-xs"
                  >
                    Cancel
                  </button>
                </div>
                {loadingMyAgents ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-4 h-4 border-2 border-rumi-accent border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : myAgents.length === 0 ? (
                  <p className="text-gray-500 text-xs text-center py-4">
                    No agents available to add. All your agents are already in this team.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {myAgents.map((agent) => (
                      <div
                        key={agent.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg border border-rumi-border hover:border-rumi-accent/30 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-gray-200 truncate">{agent.name}</p>
                          <p className="text-[10px] text-gray-600">{agent.status || 'draft'}</p>
                        </div>
                        <button
                          onClick={() => handleMoveAgent(agent.id)}
                          disabled={addingAgent === agent.id}
                          className="rumi-btn-primary text-[10px] px-2 py-1"
                        >
                          {addingAgent === agent.id ? 'Moving...' : 'Add'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {agents.length === 0 && !showAddAgent ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-sm">No agents in this team yet</p>
                <p className="text-gray-600 text-xs mt-1">Add agents from your dashboard to this team</p>
                {canManage && (
                  <button
                    onClick={handleOpenAddAgent}
                    className="rumi-btn-primary text-xs mt-4"
                  >
                    Add Agent
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="rumi-card cursor-pointer group"
                    onClick={() => navigate(`/agent/${agent.id}`)}
                  >
                    <h3 className="text-sm font-semibold text-th-primary group-hover:text-rumi-accent transition-colors truncate">
                      {agent.name}
                    </h3>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      by {agent.owner_name || agent.owner_email}
                    </p>
                    {agent.description && (
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2">{agent.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Members tab */}
        {tab === 'members' && (
          <div>
            {/* Invite form */}
            {canManage && (
              <form onSubmit={handleInvite} className="flex items-end gap-2 mb-6">
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Invite by email</label>
                  <input
                    type="email"
                    className="rumi-input text-sm"
                    placeholder="teammate@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="w-24">
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Role</label>
                  <select
                    className="rumi-input text-sm"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button type="submit" disabled={inviting} className="rumi-btn-primary text-xs h-[38px] px-4">
                  {inviting ? '...' : 'Invite'}
                </button>
              </form>
            )}
            {inviteError && <p className="text-red-400 text-xs mb-4">{inviteError}</p>}

            {/* Members list */}
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.user_id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-rumi-dark/50 border border-rumi-border">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-rumi-accent/20 flex items-center justify-center">
                      <span className="text-rumi-accent text-xs font-semibold">
                        {(member.name || member.email || member.invited_email)?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-200">
                          {member.name || member.email || member.invited_email}
                        </span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${roleColors[member.role] || roleColors.member}`}>
                          {member.role}
                        </span>
                        {!member.joined_at && (
                          <span className="text-[10px] text-yellow-500/60">Pending invite</span>
                        )}
                      </div>
                      {member.email && member.name && (
                        <p className="text-[10px] text-gray-600">{member.email}</p>
                      )}
                    </div>
                  </div>

                  {canManage && member.role !== 'owner' && member.user_id !== user?.id && (
                    <div className="flex items-center gap-2">
                      {org?.my_role === 'owner' && (
                        <select
                          className="rumi-input text-xs py-1"
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                      <button
                        onClick={() => handleRemove(member.user_id)}
                        className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
