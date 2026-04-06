import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ConnectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import useCanvasStore from '../../stores/canvasStore';
import useAuthStore from '../../stores/authStore';
import { agentApi } from '../../utils/api';
import { BLOCK_TYPES } from '../../utils/blockTypes';
import AgentBlockNode from '../Blocks/AgentBlockNode';
import BlockPalette from '../Panels/BlockPalette';
import DetailPanel from '../Panels/DetailPanel';
import CanvasToolbar from './CanvasToolbar';
import CustomEdge, { EdgeArrowMarker } from './CustomEdge';
import ExportModal from '../Export/ExportModal';
import PresentationMode from '../Export/PresentationMode';
import KeyboardShortcuts from './KeyboardShortcuts';
import ShareModal from '../Collaboration/ShareModal';
import CommentsPanel from '../Collaboration/CommentsPanel';
import ActivityPanel from '../Collaboration/ActivityPanel';
import { CollaboratorCursors, PresenceIndicator, NodeSelectionOverlay } from '../Collaboration/CollaboratorCursors';
import useCollaboration from '../../hooks/useCollaboration';
import AlignmentGuides from './AlignmentGuides';

const nodeTypes = { agentBlock: AgentBlockNode };
const edgeTypes = { custom: CustomEdge };

export default function CanvasPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [commentNodeId, setCommentNodeId] = useState(null);
  const [lockedNodeId, setLockedNodeId] = useState(null); // nodeId we currently have locked
  const [saveError, setSaveError] = useState(null);
  const lockedNodeIdRef = useRef(null);
  const saveInFlightRef = useRef(false);
  const saveErrorTimerRef = useRef(null);

  const {
    nodes,
    edges,
    buildName,
    isDirty,
    detailPanelOpen,
    onNodesChange,
    onEdgesChange,
    addNode,
    addEdge,
    reconnectEdge,
    updateEdgeType,
    updateEdgeDirection,
    removeEdge,
    loadBuild,
    getCanvasData,
    markSaved,
    setBuildMeta,
    openDetailPanel,
    setSelectedNode,
    setSelectedEdge,
    removeNode,
    optimizeConnectedEdgeHandles,
    applyAutoLayout,
    reset,
    undo,
    redo,
  } = useCanvasStore();

  // Real-time collaboration
  const {
    connected: collabConnected,
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
  } = useCollaboration(id);

  // Load agent build
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await agentApi.get(id);
        if (mounted) {
          loadBuild(data.agent);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load agent:', err);
        if (mounted) navigate('/');
      }
    };
    load();
    return () => {
      mounted = false;
      // Unlock any block we had locked
      if (lockedNodeIdRef.current) sendBlockUnlock(lockedNodeIdRef.current);
      if (saveErrorTimerRef.current) {
        clearTimeout(saveErrorTimerRef.current);
      }
      reset();
    };
  }, [id]);

  // Keyboard shortcuts
  useEffect(() => {
    lockedNodeIdRef.current = lockedNodeId || null;
  }, [lockedNodeId]);

  // Keyboard shortcuts
  useEffect(() => {
    const isEditableTarget = (target) => {
      if (!target || !(target instanceof Element)) return false;
      return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
    };

    const handleKeyDown = (e) => {
      if (isEditableTarget(e.target)) return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === '?') {
        setShowShortcuts((s) => !s);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useCanvasStore.getState();

        // Delete selected edges first (never delete connected blocks in this branch).
        const selectedEdgeIds = state.edges.filter((edge) => edge.selected).map((edge) => edge.id);
        if (selectedEdgeIds.length > 0) {
          e.preventDefault();
          selectedEdgeIds.forEach((edgeId) => removeEdge(edgeId));
          setSelectedEdge(null);
          setSelectedNode(null);
          return;
        }

        // Then delete selected nodes based on live ReactFlow selection state.
        // Fallback to selectedNode for older selection paths.
        const selectedNodeIds = state.nodes.filter((node) => node.selected).map((node) => node.id);
        const nodeIdsToDelete = selectedNodeIds.length > 0
          ? selectedNodeIds
          : (state.selectedNode ? [state.selectedNode] : []);

        if (nodeIdsToDelete.length > 0) {
          e.preventDefault();
          nodeIdsToDelete.forEach((nodeId) => {
            const lock = blockLocks[nodeId];
            if (lock && lock.userId !== user?.id) return;
            removeNode(nodeId);
          });
          setSelectedNode(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [blockLocks, user, removeEdge, removeNode, setSelectedEdge, setSelectedNode, redo, undo]);

  // Save with conflict detection
  const handleSave = useCallback(async () => {
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const canvasData = getCanvasData();
      const state = useCanvasStore.getState();
      const result = await agentApi.update(id, {
        name: state.buildName,
        description: state.buildDescription,
        status: state.buildStatus,
        canvas_data: canvasData,
        expected_updated_at: state.lastSaved,
      });
      markSaved();
      // Store the server's updated_at for next conflict check
      if (result.updated_at) {
        useCanvasStore.setState({ lastSaved: result.updated_at });
      }
    } catch (err) {
      console.error('Failed to save:', err);
      if (err.message.includes('Conflict')) {
        setSaveError('Another user modified this agent. Reload to get the latest version.');
      } else if (err.message.includes('too large')) {
        setSaveError('Canvas data is too large to save.');
      } else {
        setSaveError('Failed to save. Please try again.');
      }
      // Auto-clear error after 8s
      if (saveErrorTimerRef.current) clearTimeout(saveErrorTimerRef.current);
      saveErrorTimerRef.current = setTimeout(() => setSaveError(null), 8000);
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }, [id, getCanvasData, markSaved]);

  // Auto-save every 30s if dirty
  useEffect(() => {
    const interval = setInterval(() => {
      if (!saveInFlightRef.current && useCanvasStore.getState().isDirty) {
        handleSave();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [handleSave]);

  // Drop handler
  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      const blockType = e.dataTransfer.getData('application/rumi-block-type');
      if (!blockType || !BLOCK_TYPES[blockType]) return;
      if (!reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      addNode(blockType, position);
    },
    [reactFlowInstance, addNode]
  );

  // Connect handler
  const onConnect = useCallback(
    (connection) => {
      addEdge(connection);
    },
    [addEdge]
  );

  const onReconnect = useCallback(
    (oldEdge, newConnection) => {
      if (!oldEdge?.id || !newConnection?.source || !newConnection?.target) return;
      reconnectEdge(oldEdge.id, newConnection);
    },
    [reconnectEdge]
  );

  // Compatibility for React Flow versions that still emit onEdgeUpdate.
  const onEdgeUpdate = useCallback(
    (oldEdge, newConnection) => {
      if (!oldEdge?.id || !newConnection?.source || !newConnection?.target) return;
      reconnectEdge(oldEdge.id, newConnection);
    },
    [reconnectEdge]
  );

  // Edge change handler passed through edge data
  const handleEdgeTypeChange = useCallback(
    (edgeId, connectionType) => {
      updateEdgeType(edgeId, connectionType);
    },
    [updateEdgeType]
  );

  const handleEdgeDirectionChange = useCallback(
    (edgeId, arrowDirection) => {
      updateEdgeDirection(edgeId, arrowDirection);
    },
    [updateEdgeDirection]
  );

  // Prepare edges with change handler and custom type
  const edgesWithHandlers = edges.map((e) => ({
    ...e,
    type: 'custom',
    reconnectable: true,
    updatable: true,
    data: {
      ...e.data,
      onChange: handleEdgeTypeChange,
      onDirectionChange: handleEdgeDirectionChange,
    },
  }));

  // Mouse move for cursor sharing (throttled)
  const lastCursorSend = useRef(0);
  const onMouseMove = useCallback((e) => {
    if (!reactFlowInstance) return;
    const now = Date.now();
    if (now - lastCursorSend.current < 50) return; // throttle to 20fps
    lastCursorSend.current = now;
    const pos = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    sendCursorMove(pos.x, pos.y);
  }, [reactFlowInstance, sendCursorMove]);

  // Auto-layout handler
  const handleAutoLayout = useCallback((direction = 'TB', options = {}) => {
    const { fit = true } = options;
    applyAutoLayout(direction);
    if (fit) {
      // Fit view after layout with a small delay for React to re-render
      setTimeout(() => {
        if (reactFlowInstance) reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
      }, 50);
    }
  }, [applyAutoLayout, reactFlowInstance]);

  // After a block move finishes, optimize only connected edge handles (no global relayout / no zoom jump).
  const onNodeDragStop = useCallback((_, node) => {
    optimizeConnectedEdgeHandles(node?.id);
  }, [optimizeConnectedEdgeHandles]);

  // Node click
  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node.id);
    setSelectedEdge(null);
    sendNodeSelect(node.id);
  }, [setSelectedNode, setSelectedEdge, sendNodeSelect]);

  const onEdgeClick = useCallback((_, edge) => {
    setSelectedEdge(edge?.id || null);
    setSelectedNode(null);
  }, [setSelectedEdge, setSelectedNode]);

  // Node double click — open detail panel with block locking
  const onNodeDoubleClick = useCallback((_, node) => {
    // Check if locked by someone else
    const lock = blockLocks[node.id];
    if (lock && lock.userId !== user?.id) {
      // Block is locked by another user
      return;
    }

    // Unlock previous block if we had one
    if (lockedNodeId && lockedNodeId !== node.id) {
      sendBlockUnlock(lockedNodeId);
    }

    // Lock this block
    sendBlockLock(node.id);
    lockedNodeIdRef.current = node.id;
    setLockedNodeId(node.id);
    openDetailPanel(node.id);
  }, [openDetailPanel, blockLocks, user, lockedNodeId, sendBlockLock, sendBlockUnlock]);

  // Handle detail panel close — unlock block
  const handleCloseDetailPanel = useCallback(() => {
    if (lockedNodeId) {
      sendBlockUnlock(lockedNodeId);
      lockedNodeIdRef.current = null;
      setLockedNodeId(null);
    }
    useCanvasStore.getState().closeDetailPanel();
  }, [lockedNodeId, sendBlockUnlock]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-rumi-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading agent...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Canvas toolbar */}
      <CanvasToolbar
        buildName={buildName}
        onNameChange={(name) => setBuildMeta({ buildName: name, isDirty: true })}
        onSave={handleSave}
        saving={saving}
        isDirty={isDirty}
        onExport={() => setShowExport(true)}
        onPresent={() => setShowPresentation(true)}
        onShare={() => setShowShare(true)}
        onComments={() => setShowComments(!showComments)}
        showComments={showComments}
        onActivity={() => setShowActivity(!showActivity)}
        showActivity={showActivity}
        onAutoLayout={handleAutoLayout}
        onBack={() => navigate('/')}
        nodeCount={nodes.length}
        edgeCount={edges.length}
        collaborators={collaborators}
        collabConnected={collabConnected}
      />

      {/* Main canvas area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Block palette */}
        <BlockPalette />

        {/* React Flow canvas */}
        <div className="flex-1 relative" ref={reactFlowWrapper} onMouseMove={onMouseMove}>
          <EdgeArrowMarker />
          <ReactFlow
            nodes={nodes}
            edges={edgesWithHandlers}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onEdgeUpdate={onEdgeUpdate}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeDragStop={onNodeDragStop}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Loose}
            edgesReconnectable={true}
            edgesUpdatable={true}
            connectionRadius={72}
            fitView
            snapToGrid
            snapGrid={[16, 16]}
            defaultEdgeOptions={{
              type: 'custom',
              animated: false,
              reconnectable: true,
              updatable: true,
              data: { connectionType: 'data', arrowDirection: 'forward', onChange: handleEdgeTypeChange, onDirectionChange: handleEdgeDirectionChange },
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="var(--rumi-canvas-dots)"
            />
            <AlignmentGuides />
            <Controls showInteractive={false} />
            <MiniMap
              nodeStrokeWidth={3}
              nodeColor={(n) => {
                const bt = BLOCK_TYPES[n.data?.blockType];
                return bt?.color || '#6b7280';
              }}
              maskColor="rgba(10, 14, 26, 0.7)"
              style={{ width: 150, height: 100 }}
            />
          </ReactFlow>

          {/* Block lock overlays */}
          {Object.entries(blockLocks).map(([nodeId, lock]) => {
            if (lock.userId === user?.id) return null;
            const node = nodes.find((n) => n.id === nodeId);
            if (!node) return null;
            return (
              <div
                key={`lock-${nodeId}`}
                className="absolute pointer-events-none z-30"
                style={{
                  left: node.position?.x - 2,
                  top: node.position?.y - 2,
                  width: (node.measured?.width || 200) + 4,
                  height: (node.measured?.height || 80) + 4,
                }}
              >
                <div className="w-full h-full rounded-xl border-2 border-orange-400/60 bg-orange-500/5" />
                <div className="absolute -top-5 left-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500 text-[8px] font-medium text-white whitespace-nowrap">
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  {lock.userName?.split('@')[0]} editing
                </div>
              </div>
            );
          })}

          {/* Save error notification */}
          {saveError && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/15 border border-red-500/30 backdrop-blur shadow-lg">
              <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-xs text-red-300">{saveError}</span>
              <button
                onClick={() => setSaveError(null)}
                className="text-red-400 hover:text-red-200 ml-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

        </div>

        {/* Detail panel */}
        {detailPanelOpen && (
          <DetailPanel
            onOpenComments={(nodeId) => {
              setCommentNodeId(nodeId);
              setShowComments(true);
            }}
            onClose={handleCloseDetailPanel}
            blockLocks={blockLocks}
            currentUserId={user?.id}
          />
        )}

        {/* Comments panel */}
        {showComments && (
          <CommentsPanel
            buildId={id}
            nodeId={commentNodeId || useCanvasStore.getState().detailPanelNode?.id}
            onClose={() => setShowComments(false)}
            onCommentAdded={(comment) => sendCommentAdded(comment)}
          />
        )}

        {/* Activity panel */}
        {showActivity && (
          <ActivityPanel
            buildId={id}
            onClose={() => setShowActivity(false)}
          />
        )}
      </div>

      {/* Modals */}
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      {showPresentation && <PresentationMode onClose={() => setShowPresentation(false)} />}
      {showShortcuts && <KeyboardShortcuts onClose={() => setShowShortcuts(false)} />}
      {showShare && <ShareModal buildId={id} onClose={() => setShowShare(false)} />}
    </div>
  );
}
