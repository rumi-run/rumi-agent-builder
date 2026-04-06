import { create } from 'zustand';
import { BLOCK_TYPES } from '../utils/blockTypes';
import { autoLayout } from '../utils/layoutUtils';

let nodeIdCounter = 0;
const generateId = () => `node_${Date.now()}_${++nodeIdCounter}`;
let edgeIdCounter = 0;
const generateEdgeId = () => `edge_${Date.now()}_${++edgeIdCounter}`;

const useCanvasStore = create((set, get) => ({
  // Canvas state
  nodes: [],
  edges: [],
  selectedNode: null,
  selectedEdge: null,

  // Agent build metadata
  buildId: null,
  buildName: 'Untitled Agent',
  buildDescription: '',
  buildStatus: 'draft',
  isDirty: false,
  lastSaved: null,

  // Undo/Redo
  history: [],
  historyIndex: -1,

  // Panel state
  detailPanelOpen: false,
  detailPanelNode: null,

  // Save snapshot for undo
  _pushHistory: () => {
    const { nodes, edges, history, historyIndex } = get();
    const snapshot = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(snapshot);
    if (newHistory.length > 50) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  // Node operations
  addNode: (type, position) => {
    const blockDef = BLOCK_TYPES[type];
    if (!blockDef) return;

    get()._pushHistory();
    const id = generateId();
    const newNode = {
      id,
      type: 'agentBlock',
      position,
      data: {
        blockType: type,
        ...JSON.parse(JSON.stringify(blockDef.defaultData)),
      },
    };
    set((state) => ({
      nodes: [...state.nodes, newNode],
      isDirty: true,
    }));
    return id;
  },

  updateNodeData: (nodeId, data) => {
    get()._pushHistory();
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
      isDirty: true,
    }));
  },

  removeNode: (nodeId) => {
    get()._pushHistory();
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNode: state.selectedNode === nodeId ? null : state.selectedNode,
      isDirty: true,
    }));
  },

  // Edge operations
  addEdge: (edge) => {
    get()._pushHistory();
    const newEdge = {
      ...edge,
      // Use unique id instead of endpoint-derived id.
      // Endpoint-derived ids can collide and block expected connections.
      id: generateEdgeId(),
      type: 'smoothstep',
      data: { connectionType: 'data' },
    };
    set((state) => ({
      edges: [...state.edges, newEdge],
      isDirty: true,
    }));
  },

  removeEdge: (edgeId) => {
    get()._pushHistory();
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== edgeId),
      isDirty: true,
    }));
  },

  updateEdgeType: (edgeId, connectionType) => {
    get()._pushHistory();
    set((state) => ({
      edges: state.edges.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, connectionType } } : e
      ),
      isDirty: true,
    }));
  },

  updateEdgeDirection: (edgeId, arrowDirection) => {
    get()._pushHistory();
    set((state) => ({
      edges: state.edges.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, arrowDirection } } : e
      ),
      isDirty: true,
    }));
  },

  optimizeConnectedEdgeHandles: (nodeId) => {
    if (!nodeId) return;
    const getNodeCenter = (node) => {
      const w = node?.measured?.width || 220;
      const h = node?.measured?.height || 80;
      return {
        x: (node?.position?.x || 0) + w / 2,
        y: (node?.position?.y || 0) + h / 2,
      };
    };

    set((state) => {
      const nodeMap = new Map(state.nodes.map((n) => [n.id, n]));
      const current = nodeMap.get(nodeId);
      if (!current) return {};

      const nextEdges = state.edges.map((edge) => {
        if (edge.source !== nodeId && edge.target !== nodeId) return edge;
        const srcNode = nodeMap.get(edge.source);
        const tgtNode = nodeMap.get(edge.target);
        if (!srcNode || !tgtNode) return edge;

        const s = getNodeCenter(srcNode);
        const t = getNodeCenter(tgtNode);
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const horizontal = Math.abs(dx) >= Math.abs(dy);

        let sourceHandle;
        let targetHandle;
        if (horizontal) {
          sourceHandle = dx >= 0 ? 'right' : 'left';
          targetHandle = dx >= 0 ? 'left' : 'right';
        } else {
          sourceHandle = dy >= 0 ? 'bottom' : 'top';
          targetHandle = dy >= 0 ? 'top' : 'bottom';
        }

        return {
          ...edge,
          sourceHandle,
          targetHandle,
        };
      });

      return {
        edges: nextEdges,
        isDirty: true,
      };
    });
  },

  reconnectEdge: (edgeId, connection) => {
    if (!edgeId || !connection?.source || !connection?.target) return;
    get()._pushHistory();
    set((state) => ({
      edges: state.edges.map((e) => {
        if (e.id !== edgeId) return e;
        // Keep existing edge id when reconnecting.
        // Recomputing id from endpoints can collide with an existing edge and make reconnect fail.
        return {
          ...e,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle || null,
          targetHandle: connection.targetHandle || null,
        };
      }),
      isDirty: true,
    }));
  },

  // React Flow callbacks
  onNodesChange: (changes) => {
    set((state) => {
      const updated = applyNodeChanges(state.nodes, changes);
      return { nodes: updated, isDirty: true };
    });
  },

  onEdgesChange: (changes) => {
    set((state) => {
      const updated = applyEdgeChanges(state.edges, changes);
      return { edges: updated, isDirty: true };
    });
  },

  // Selection
  setSelectedNode: (nodeId) => set({ selectedNode: nodeId }),
  setSelectedEdge: (edgeId) => set({ selectedEdge: edgeId }),

  // Detail panel
  openDetailPanel: (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (node) set({ detailPanelOpen: true, detailPanelNode: node });
  },
  closeDetailPanel: () => set({ detailPanelOpen: false, detailPanelNode: null }),

  // Undo / Redo
  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    set({
      nodes: JSON.parse(JSON.stringify(prev.nodes)),
      edges: JSON.parse(JSON.stringify(prev.edges)),
      historyIndex: historyIndex - 1,
      isDirty: true,
    });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    set({
      nodes: JSON.parse(JSON.stringify(next.nodes)),
      edges: JSON.parse(JSON.stringify(next.edges)),
      historyIndex: historyIndex + 1,
      isDirty: true,
    });
  },

  // Build management
  setBuildMeta: (meta) => set(meta),

  loadBuild: (build) => {
    const canvasData = build.canvas_data || { nodes: [], edges: [] };
    set({
      buildId: build.id,
      buildName: build.name,
      buildDescription: build.description || '',
      buildStatus: build.status || 'draft',
      nodes: canvasData.nodes || [],
      edges: canvasData.edges || [],
      isDirty: false,
      lastSaved: build.updated_at,
      history: [],
      historyIndex: -1,
    });
  },

  getCanvasData: () => {
    const { nodes, edges } = get();
    return { nodes, edges };
  },

  applyAutoLayout: (direction = 'TB') => {
    get()._pushHistory();
    const { nodes, edges } = get();
    const result = autoLayout(nodes, edges, direction);
    set({ nodes: result.nodes, isDirty: true });
  },

  clearCanvas: () => {
    get()._pushHistory();
    set({ nodes: [], edges: [], isDirty: true });
  },

  markSaved: () => set({ isDirty: false, lastSaved: new Date().toISOString() }),

  // Reset state
  reset: () => set({
    nodes: [],
    edges: [],
    selectedNode: null,
    selectedEdge: null,
    buildId: null,
    buildName: 'Untitled Agent',
    buildDescription: '',
    buildStatus: 'draft',
    isDirty: false,
    lastSaved: null,
    history: [],
    historyIndex: -1,
    detailPanelOpen: false,
    detailPanelNode: null,
  }),
}));

// Helper functions for React Flow changes
function applyNodeChanges(nodes, changes) {
  let updated = [...nodes];
  for (const change of changes) {
    if (change.type === 'position' && change.position) {
      updated = updated.map((n) =>
        n.id === change.id ? { ...n, position: change.position } : n
      );
    } else if (change.type === 'remove') {
      updated = updated.filter((n) => n.id !== change.id);
    } else if (change.type === 'select') {
      updated = updated.map((n) =>
        n.id === change.id ? { ...n, selected: change.selected } : n
      );
    } else if (change.type === 'dimensions' && change.dimensions) {
      updated = updated.map((n) =>
        n.id === change.id ? { ...n, measured: { width: change.dimensions.width, height: change.dimensions.height } } : n
      );
    }
  }
  return updated;
}

function applyEdgeChanges(edges, changes) {
  let updated = [...edges];
  for (const change of changes) {
    if (change.type === 'remove') {
      updated = updated.filter((e) => e.id !== change.id);
    } else if (change.type === 'select') {
      updated = updated.map((e) =>
        e.id === change.id ? { ...e, selected: change.selected } : e
      );
    }
  }
  return updated;
}

export default useCanvasStore;
