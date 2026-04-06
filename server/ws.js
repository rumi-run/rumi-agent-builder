const { WebSocketServer } = require('ws');
const { db } = require('./db');
const authService = require('./services/authService');
const { fetchSsoMe } = require('./services/ssoClient');

// Active connections: Map<buildId, Set<{ws, userId, userName, userEmail}>>
const rooms = new Map();
// Block locks: Map<buildId, Map<nodeId, {userId, userName, lockedAt}>>
const blockLocks = new Map();

function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws/collab' });

  wss.on('connection', async (ws, req) => {
    const cookieHeader = req.headers.cookie || '';
    const cookies = parseCookies(cookieHeader);

    let session = null;
    const ssoUser = await fetchSsoMe(cookieHeader);
    if (ssoUser) {
      session = await authService.ensureLocalUserFromSso(ssoUser);
    }
    if (!session) {
      const sessionId = cookies.rumi_session;
      if (sessionId) session = await authService.getSession(sessionId);
    }

    if (!session) {
      ws.close(4001, 'Authentication required');
      return;
    }

    const userId = session.user_id;
    const userName = session.name || session.email;
    const userEmail = session.email;

    // Parse the buildId from query params
    const url = new URL(req.url, 'http://localhost');
    const buildId = url.searchParams.get('buildId');

    if (!buildId) {
      ws.close(4002, 'buildId required');
      return;
    }

    // Verify access to the build
    const accessLevel = await checkAccess(buildId, userId, userEmail);
    if (!accessLevel) {
      ws.close(4003, 'No access to this agent');
      return;
    }

    // Join the room
    if (!rooms.has(buildId)) rooms.set(buildId, new Set());
    const client = { ws, userId, userName, userEmail, buildId, accessLevel };
    rooms.get(buildId).add(client);

    const canWrite = accessLevel === 'owner' || accessLevel === 'edit';

    // Record presence
    await db.runAsync(
      `INSERT OR REPLACE INTO active_presence (build_id, user_id, user_name, user_email, last_seen)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [buildId, userId, userName, userEmail]
    );

    // Send current presence list and block locks to the new client
    const presenceList = getPresenceList(buildId);
    const locks = blockLocks.get(buildId) ? Object.fromEntries(blockLocks.get(buildId)) : {};
    ws.send(JSON.stringify({ type: 'presence', users: presenceList, locks }));

    // Broadcast join to others
    broadcast(buildId, { type: 'user_joined', user: { userId, userName, userEmail } }, ws);

    // Handle messages
    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      switch (msg.type) {
        case 'cursor_move':
          broadcast(buildId, {
            type: 'cursor_move',
            userId,
            userName,
            x: msg.x,
            y: msg.y,
          }, ws);
          break;

        case 'node_select':
          broadcast(buildId, {
            type: 'node_select',
            userId,
            userName,
            nodeId: msg.nodeId,
          }, ws);
          break;

        case 'canvas_update':
          if (!canWrite) {
            ws.send(JSON.stringify({ type: 'forbidden', action: 'canvas_update' }));
            break;
          }
          // Broadcast canvas changes to other clients
          broadcast(buildId, {
            type: 'canvas_update',
            userId,
            userName,
            action: msg.action,
            payload: msg.payload,
          }, ws);
          break;

        case 'block_lock': {
          if (!canWrite) {
            ws.send(JSON.stringify({ type: 'forbidden', action: 'block_lock' }));
            break;
          }
          const nodeId = msg.nodeId;
          if (!nodeId) break;
          if (!blockLocks.has(buildId)) blockLocks.set(buildId, new Map());
          const locks = blockLocks.get(buildId);
          const existing = locks.get(nodeId);
          // Only lock if not already locked by someone else
          if (!existing || existing.userId === userId) {
            locks.set(nodeId, { userId, userName, lockedAt: Date.now() });
            broadcast(buildId, {
              type: 'block_locked',
              nodeId,
              userId,
              userName,
            });
          } else {
            // Tell the requester the block is already locked
            ws.send(JSON.stringify({
              type: 'block_lock_denied',
              nodeId,
              lockedBy: existing.userName,
            }));
          }
          break;
        }

        case 'block_unlock': {
          if (!canWrite) {
            ws.send(JSON.stringify({ type: 'forbidden', action: 'block_unlock' }));
            break;
          }
          const unlockNodeId = msg.nodeId;
          if (!unlockNodeId) break;
          const buildLocks = blockLocks.get(buildId);
          if (buildLocks) {
            const lock = buildLocks.get(unlockNodeId);
            if (lock && lock.userId === userId) {
              buildLocks.delete(unlockNodeId);
              broadcast(buildId, {
                type: 'block_unlocked',
                nodeId: unlockNodeId,
                userId,
              });
            }
          }
          break;
        }

        case 'comment_added':
          if (!canWrite) {
            ws.send(JSON.stringify({ type: 'forbidden', action: 'comment_added' }));
            break;
          }
          broadcast(buildId, {
            type: 'comment_added',
            userId,
            userName,
            comment: msg.comment,
          }, ws);
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
      }
    });

    // Handle disconnect
    let cleanedUp = false;
    const cleanupClient = async () => {
      if (cleanedUp) return;
      cleanedUp = true;
      rooms.get(buildId)?.delete(client);
      if (rooms.get(buildId)?.size === 0) rooms.delete(buildId);

      // Release all block locks held by this user
      const buildLocks = blockLocks.get(buildId);
      if (buildLocks) {
        for (const [nodeId, lock] of buildLocks) {
          if (lock.userId === userId) {
            buildLocks.delete(nodeId);
            broadcast(buildId, { type: 'block_unlocked', nodeId, userId });
          }
        }
        if (buildLocks.size === 0) blockLocks.delete(buildId);
      }

      // Remove presence
      await db.runAsync(
        `DELETE FROM active_presence WHERE build_id = ? AND user_id = ?`,
        [buildId, userId]
      ).catch(() => {});

      // Broadcast leave
      broadcast(buildId, { type: 'user_left', user: { userId, userName } });
    };

    ws.on('close', async () => {
      await cleanupClient();
    });

    ws.on('error', async () => {
      await cleanupClient();
    });
  });

  // Heartbeat — clean stale connections and locks every 30s
  setInterval(() => {
    for (const [buildId, clients] of rooms) {
      const removedUserIds = new Set();
      for (const client of clients) {
        if (client.ws.readyState !== 1) {
          removedUserIds.add(client.userId);
          clients.delete(client);
        }
      }
      if (clients.size === 0) rooms.delete(buildId);

      // Clean block locks held by disconnected users
      if (removedUserIds.size > 0) {
        const buildLocksMap = blockLocks.get(buildId);
        if (buildLocksMap) {
          for (const [nodeId, lock] of buildLocksMap) {
            if (removedUserIds.has(lock.userId)) {
              buildLocksMap.delete(nodeId);
              broadcast(buildId, { type: 'block_unlocked', nodeId, userId: lock.userId });
            }
          }
          if (buildLocksMap.size === 0) blockLocks.delete(buildId);
        }
      }
    }

    // Expire stale locks older than 5 minutes (safety net)
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    for (const [buildId, locksMap] of blockLocks) {
      for (const [nodeId, lock] of locksMap) {
        if (lock.lockedAt < fiveMinAgo) {
          locksMap.delete(nodeId);
          broadcast(buildId, { type: 'block_unlocked', nodeId, userId: lock.userId });
        }
      }
      if (locksMap.size === 0) blockLocks.delete(buildId);
    }
  }, 30000);

  return wss;
}

function broadcast(buildId, message, excludeWs) {
  const room = rooms.get(buildId);
  if (!room) return;
  const data = JSON.stringify(message);
  for (const client of room) {
    if (client.ws !== excludeWs && client.ws.readyState === 1) {
      client.ws.send(data);
    }
  }
}

function getPresenceList(buildId) {
  const room = rooms.get(buildId);
  if (!room) return [];
  const users = [];
  const seen = new Set();
  for (const client of room) {
    if (!seen.has(client.userId)) {
      seen.add(client.userId);
      users.push({
        userId: client.userId,
        userName: client.userName,
        userEmail: client.userEmail,
      });
    }
  }
  return users;
}

async function checkAccess(buildId, userId, userEmail) {
  // Owner
  const owned = await db.getAsync(
    `SELECT id FROM agent_builds WHERE id = ? AND user_id = ?`,
    [buildId, userId]
  );
  if (owned) return 'owner';

  // Shared
  const shared = await db.getAsync(
    `SELECT permission FROM agent_shares
     WHERE build_id = ? AND shared_with_email = ?
     AND (expires_at IS NULL OR expires_at > datetime('now'))`,
    [buildId, userEmail]
  );
  if (shared) return shared.permission === 'edit' ? 'edit' : 'view';

  // Org member
  const orgAccess = await db.getAsync(
    `SELECT a.id FROM agent_builds a
     JOIN org_members m ON m.org_id = a.org_id AND m.user_id = ? AND m.joined_at IS NOT NULL
     WHERE a.id = ? AND a.visibility = 'org'`,
    [userId, buildId]
  );
  if (orgAccess) return 'edit';

  return null;
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((c) => {
    const [name, ...rest] = c.trim().split('=');
    if (name) cookies[name] = decodeURIComponent(rest.join('='));
  });
  return cookies;
}

module.exports = { setupWebSocket };
