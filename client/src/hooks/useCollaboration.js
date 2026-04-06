import { useEffect, useRef, useCallback, useState } from 'react';

const WS_BASE = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

export default function useCollaboration(buildId, { onCanvasUpdate, onCommentAdded } = {}) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [cursors, setCursors] = useState({});
  const [selections, setSelections] = useState({});
  const [blockLocks, setBlockLocks] = useState({}); // nodeId -> {userId, userName}
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    if (!buildId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_BASE}/ws/collab?buildId=${buildId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case 'presence':
          setCollaborators(msg.users || []);
          if (msg.locks) setBlockLocks(msg.locks);
          break;

        case 'user_joined':
          setCollaborators((prev) => {
            if (prev.find((u) => u.userId === msg.user.userId)) return prev;
            return [...prev, msg.user];
          });
          break;

        case 'user_left':
          setCollaborators((prev) => prev.filter((u) => u.userId !== msg.user.userId));
          setCursors((prev) => {
            const next = { ...prev };
            delete next[msg.user.userId];
            return next;
          });
          setSelections((prev) => {
            const next = { ...prev };
            delete next[msg.user.userId];
            return next;
          });
          break;

        case 'cursor_move':
          setCursors((prev) => ({
            ...prev,
            [msg.userId]: { x: msg.x, y: msg.y, userName: msg.userName },
          }));
          break;

        case 'node_select':
          setSelections((prev) => ({
            ...prev,
            [msg.userId]: { nodeId: msg.nodeId, userName: msg.userName },
          }));
          break;

        case 'block_locked':
          setBlockLocks((prev) => ({
            ...prev,
            [msg.nodeId]: { userId: msg.userId, userName: msg.userName },
          }));
          break;

        case 'block_unlocked':
          setBlockLocks((prev) => {
            const next = { ...prev };
            delete next[msg.nodeId];
            return next;
          });
          break;

        case 'block_lock_denied':
          // Could show a toast - for now just ignore silently
          break;

        case 'canvas_update':
          onCanvasUpdate?.(msg);
          break;

        case 'comment_added':
          onCommentAdded?.(msg);
          break;

        case 'pong':
          break;
      }
    };

    ws.onclose = (event) => {
      setConnected(false);
      wsRef.current = null;
      // Reconnect after 2s unless intentional close
      if (event.code !== 4001 && event.code !== 4003) {
        reconnectTimer.current = setTimeout(connect, 2000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [buildId, onCanvasUpdate, onCommentAdded]);

  useEffect(() => {
    connect();
    // Ping every 25s to keep alive
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendCursorMove = useCallback((x, y) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cursor_move', x, y }));
    }
  }, []);

  const sendNodeSelect = useCallback((nodeId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'node_select', nodeId }));
    }
  }, []);

  const sendCanvasUpdate = useCallback((action, payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'canvas_update', action, payload }));
    }
  }, []);

  const sendCommentAdded = useCallback((comment) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'comment_added', comment }));
    }
  }, []);

  const sendBlockLock = useCallback((nodeId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'block_lock', nodeId }));
    }
  }, []);

  const sendBlockUnlock = useCallback((nodeId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'block_unlock', nodeId }));
    }
  }, []);

  return {
    connected,
    collaborators,
    cursors,
    selections,
    blockLocks,
    sendCursorMove,
    sendNodeSelect,
    sendCanvasUpdate,
    sendCommentAdded,
    sendBlockLock,
    sendBlockUnlock,
  };
}
