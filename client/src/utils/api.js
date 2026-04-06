const API_BASE = '/api/builder';

/** Unified auth (rumi-unified-auth via Nginx /api/rumi-auth/) */
async function authRequest(path, options = {}) {
  const { method = 'GET', body, headers = {} } = options;
  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': 'en',
      ...headers,
    },
    credentials: 'include',
  };
  if (body) config.body = JSON.stringify(body);

  const res = await fetch(`/api/rumi-auth${path}`, config);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

async function request(path, options = {}) {
  const { method = 'GET', body, headers = {} } = options;
  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    credentials: 'include',
  };
  if (body) config.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, config);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

// Auth (unified OTP; aligns email with Ghost /says members when configured)
export const authApi = {
  requestCode: (email) => authRequest('/request-code', { method: 'POST', body: { email } }),
  verifyCode: (email, code) => authRequest('/verify-code', { method: 'POST', body: { email, code } }),
  me: () => authRequest('/me'),
  logout: () => authRequest('/logout', { method: 'POST' }),
  updateProfile: (data) => authRequest('/profile', { method: 'PUT', body: data }),
};

// Agent Builds
export const agentApi = {
  list: () => request('/agents'),
  get: (id) => request(`/agents/${id}`),
  create: (data) => request('/agents', { method: 'POST', body: data }),
  update: (id, data) => request(`/agents/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/agents/${id}`, { method: 'DELETE' }),
  duplicate: (id) => request(`/agents/${id}/duplicate`, { method: 'POST' }),
  getActivity: (id, limit = 50) => request(`/agents/${id}/activity?limit=${limit}`),
  getVersions: (id) => request(`/agents/${id}/versions`),
  restoreVersion: (id, versionId) => request(`/agents/${id}/versions/${versionId}/restore`, { method: 'POST' }),
  getAccess: (id) => request(`/agents/${id}/access`),
};

// Admin
export const adminApi = {
  getAiConfig: () => request('/admin/ai-config'),
  updateAiConfig: (data) => request('/admin/ai-config', { method: 'PUT', body: data }),
  getUsers: ({ page = 1, limit = 20, search = '' } = {}) => {
    const params = new URLSearchParams({ page, limit });
    if (search) params.set('search', search);
    return request(`/admin/users?${params}`);
  },
  getUsage: () => request('/admin/usage'),
};

// AI Assistance
export const aiApi = {
  generateInstructions: (prompt) =>
    request('/ai/generate-instructions', { method: 'POST', body: { prompt } }),
  validateStructure: (canvasData) =>
    request('/ai/validate-structure', { method: 'POST', body: { canvasData } }),
  suggestBlocks: (currentBlocks) =>
    request('/ai/suggest-blocks', { method: 'POST', body: { currentBlocks } }),
  generateAgentIntro: (data) =>
    request('/ai/generate-agent-intro', { method: 'POST', body: data }),
};

// Sharing
export const sharingApi = {
  createShare: (buildId, data) =>
    request(`/sharing/${buildId}/share`, { method: 'POST', body: data }),
  listShares: (buildId) => request(`/sharing/${buildId}/shares`),
  revokeShare: (shareId) => request(`/sharing/revoke/${shareId}`, { method: 'DELETE' }),
  getShared: (token) => request(`/sharing/shared/${token}`),
  sharedWithMe: () => request('/sharing/shared-with-me'),
};

// Organizations
export const orgApi = {
  list: () => request('/orgs'),
  create: (data) => request('/orgs', { method: 'POST', body: data }),
  get: (orgId) => request(`/orgs/${orgId}`),
  invite: (orgId, data) => request(`/orgs/${orgId}/invite`, { method: 'POST', body: data }),
  join: (orgId) => request(`/orgs/${orgId}/join`, { method: 'POST' }),
  removeMember: (orgId, userId) => request(`/orgs/${orgId}/members/${userId}`, { method: 'DELETE' }),
  updateRole: (orgId, userId, role) =>
    request(`/orgs/${orgId}/members/${userId}`, { method: 'PUT', body: { role } }),
  moveAgent: (orgId, buildId) =>
    request(`/orgs/${orgId}/agents/${buildId}`, { method: 'POST' }),
  listAgents: (orgId) => request(`/orgs/${orgId}/agents`),
};

// Comments
export const commentApi = {
  list: (buildId) => request(`/comments/${buildId}`),
  create: (buildId, data) => request(`/comments/${buildId}`, { method: 'POST', body: data }),
  update: (commentId, content) =>
    request(`/comments/${commentId}`, { method: 'PUT', body: { content } }),
  resolve: (commentId, resolved) =>
    request(`/comments/${commentId}/resolve`, { method: 'PUT', body: { resolved } }),
  delete: (commentId) => request(`/comments/${commentId}`, { method: 'DELETE' }),
};
