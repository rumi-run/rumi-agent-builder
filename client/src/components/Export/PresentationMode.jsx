import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
} from '@xyflow/react';
import useCanvasStore from '../../stores/canvasStore';
import { BLOCK_TYPES, CONNECTION_TYPES } from '../../utils/blockTypes';
import AgentBlockNode from '../Blocks/AgentBlockNode';
import CustomEdge, { EdgeArrowMarker } from '../Canvas/CustomEdge';

const nodeTypes = { agentBlock: AgentBlockNode };
const edgeTypes = { custom: CustomEdge };

// Priority order for block categories in a logical data flow
const FLOW_PRIORITY = {
  input: 0,       // Inputs come first
  knowledge: 1,   // Data sources
  instructions: 2, // System instructions / persona
  llm: 3,         // Core model
  tools: 4,       // Tools the model uses
  memory: 5,      // Memory config
  guardrails: 6,  // Safety rules
  variable: 7,    // Shared state
  condition: 8,   // Routing / branching
  loop: 9,        // Iteration
  subagent: 10,   // Sub-agent delegation
  connector: 11,  // Handoff protocol
  output: 12,     // Outputs come last
};

/**
 * Order nodes following the data flow graph.
 * Uses topological sort (BFS from sources) so connected nodes appear
 * in the order data actually flows. Disconnected nodes are placed
 * by their semantic category priority.
 */
function orderNodesByDataFlow(nodes, edges) {
  if (!nodes.length) return [];

  // Build adjacency and in-degree maps
  const adj = new Map();      // nodeId -> [targetIds]
  const inDegree = new Map();  // nodeId -> count of incoming edges
  const nodeMap = new Map();

  nodes.forEach((n) => {
    adj.set(n.id, []);
    inDegree.set(n.id, 0);
    nodeMap.set(n.id, n);
  });

  edges.forEach((e) => {
    if (adj.has(e.source) && inDegree.has(e.target)) {
      adj.get(e.source).push(e.target);
      inDegree.set(e.target, inDegree.get(e.target) + 1);
    }
  });

  // Kahn's algorithm: BFS topological sort
  // Start with nodes that have no incoming edges (sources)
  const queue = [];
  nodes.forEach((n) => {
    if (inDegree.get(n.id) === 0) queue.push(n.id);
  });

  // Sort initial sources by category priority so input blocks come first
  queue.sort((a, b) => {
    const pa = FLOW_PRIORITY[nodeMap.get(a)?.data?.blockType] ?? 50;
    const pb = FLOW_PRIORITY[nodeMap.get(b)?.data?.blockType] ?? 50;
    return pa - pb;
  });

  const ordered = [];
  const visited = new Set();

  while (queue.length > 0) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    ordered.push(nodeMap.get(id));

    // Get neighbors, sort by category priority for consistent ordering
    const neighbors = adj.get(id) || [];
    const ready = [];

    for (const nId of neighbors) {
      inDegree.set(nId, inDegree.get(nId) - 1);
      if (inDegree.get(nId) === 0 && !visited.has(nId)) {
        ready.push(nId);
      }
    }

    ready.sort((a, b) => {
      const pa = FLOW_PRIORITY[nodeMap.get(a)?.data?.blockType] ?? 50;
      const pb = FLOW_PRIORITY[nodeMap.get(b)?.data?.blockType] ?? 50;
      return pa - pb;
    });

    queue.push(...ready);
  }

  // Add any remaining nodes not reached (disconnected subgraphs)
  nodes.forEach((n) => {
    if (!visited.has(n.id)) {
      ordered.push(n);
    }
  });

  return ordered;
}

export default function PresentationMode({ onClose }) {
  const { nodes, edges, buildName, buildDescription } = useCanvasStore();
  const [currentStep, setCurrentStep] = useState(-1); // -1 = overview
  const [highlightedNode, setHighlightedNode] = useState(null);

  // Build ordered walk-through following data flow logic
  const orderedNodes = orderNodesByDataFlow(nodes, edges);
  const stepByNodeId = useMemo(() => {
    const m = new Map();
    orderedNodes.forEach((n, i) => {
      if (n?.id) m.set(n.id, i);
    });
    return m;
  }, [orderedNodes]);
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const totalSteps = orderedNodes.length;

  // Keyboard nav
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setCurrentStep((s) => Math.min(s + 1, totalSteps - 1));
      }
      if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
        e.preventDefault();
        setCurrentStep((s) => Math.max(s - 1, -1));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [totalSteps, onClose]);

  // Update highlighted node on step change
  useEffect(() => {
    if (currentStep >= 0 && currentStep < orderedNodes.length) {
      setHighlightedNode(orderedNodes[currentStep].id);
    } else {
      setHighlightedNode(null);
    }
  }, [currentStep, orderedNodes]);

  const handleNodeClick = useCallback((_, node) => {
    if (!node?.id) return;
    const idx = stepByNodeId.get(node.id);
    if (typeof idx === 'number') setCurrentStep(idx);
  }, [stepByNodeId]);

  // Style nodes based on current step
  const styledNodes = nodes.map((n) => ({
    ...n,
    selected: highlightedNode ? n.id === highlightedNode : n.selected,
    style: highlightedNode
      ? {
          opacity: n.id === highlightedNode ? 1 : 0.08,
          transition: 'opacity 0.25s ease',
          filter: n.id === highlightedNode ? 'drop-shadow(0 0 14px rgba(14,165,233,0.35))' : 'none',
          zIndex: n.id === highlightedNode ? 2 : 1,
        }
      : { opacity: 1, transition: 'opacity 0.25s ease' },
  }));

  // Must use type "custom" + CustomEdge (same as CanvasPage / SharedView). Persisted edges often
  // have type "smoothstep" etc.; unregistered types render no visible path in React Flow.
  const styledEdges = edges.map((e) => ({
    // Presentation mode must render connector lines reliably even if legacy edge.style is broken.
    // So we intentionally ignore persisted stroke styles and enforce visible defaults.
    ...e,
    type: 'custom',
    data: {
      ...(e.data || {}),
      connectionType: e.data?.connectionType || 'data',
      arrowDirection: e.data?.arrowDirection || 'forward',
      onChange: () => {},
      onDirectionChange: () => {},
    },
    style: {
      stroke: CONNECTION_TYPES[e.data?.connectionType || 'data']?.color || '#0ea5e9',
      strokeWidth: highlightedNode
        ? (e.source === highlightedNode || e.target === highlightedNode) ? 2.8 : 2.2
        : 2.4,
      opacity: highlightedNode
        ? (e.source === highlightedNode || e.target === highlightedNode) ? 1 : 0.08
        : 1,
      transition: 'opacity 0.3s ease',
    },
  }));

  const currentNodeData = currentStep >= 0 && currentStep < orderedNodes.length
    ? orderedNodes[currentStep].data
    : null;
  const currentBlockDef = currentNodeData ? BLOCK_TYPES[currentNodeData.blockType] : null;

  return (
    <div className="fixed inset-0 z-50 bg-rumi-dark flex flex-col">
      {/* Top bar */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-rumi-border bg-rumi-shell/80 backdrop-blur shrink-0">
        <div>
          <h1 className="text-base font-semibold text-th-primary">{buildName}</h1>
          {buildDescription && (
            <p className="text-xs text-th-muted mt-0.5">{buildDescription}</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500">
            {currentStep === -1 ? 'Overview' : `${currentStep + 1} / ${totalSteps}`}
          </span>
          <button onClick={onClose} className="rumi-btn-ghost text-xs">
            Exit Presentation
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative presentation-mode">
          <EdgeArrowMarker />

          {/* Dim the empty canvas area while stepping */}
          {highlightedNode && (
            <div className="absolute inset-0 bg-black/40 z-0 pointer-events-none" aria-hidden="true" />
          )}

          <div className="relative z-10 w-full h-full">
            <ReactFlow
              nodes={styledNodes}
              edges={styledEdges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              panOnDrag={true}
              zoomOnScroll={true}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              onNodeClick={handleNodeClick}
              defaultEdgeOptions={{
                type: 'custom',
                data: {
                  connectionType: 'data',
                  arrowDirection: 'forward',
                  onChange: () => {},
                  onDirectionChange: () => {},
                },
              }}
              proOptions={{ hideAttribution: true }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1}
                color="var(--rumi-canvas-dots)"
              />
            </ReactFlow>
          </div>
        </div>

        {/* Side info panel */}
        <div className="w-80 bg-rumi-shell border-l border-rumi-border flex flex-col shrink-0">
          {currentStep === -1 ? (
            /* Overview */
            <div className="flex-1 p-6 overflow-y-auto">
              <h2 className="text-lg font-semibold text-th-primary mb-3">Agent Overview</h2>
              <p className="text-sm text-th-muted mb-6">
                {buildDescription || 'No description provided.'}
              </p>

              <div className="space-y-2">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Components ({nodes.length})
                </h3>
                {orderedNodes.map((node, i) => {
                  const def = BLOCK_TYPES[node.data?.blockType] || {};
                  return (
                    <button
                      key={node.id}
                      onClick={() => setCurrentStep(i)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
                    >
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center text-sm shrink-0"
                        style={{ backgroundColor: (def.color || '#6b7280') + '15' }}
                      >
                        {def.icon || '📦'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-th-secondary truncate">
                          {node.data?.name || def.label}
                        </div>
                        <div className="text-xs text-th-faint truncate">{def.label}</div>
                      </div>
                      <span className="text-xs text-th-faint ml-auto shrink-0">{i + 1}</span>
                    </button>
                  );
                })}
              </div>

              {edges.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Connections ({edges.length})
                  </h3>
                  {edges.map((edge) => {
                    const src = nodeById.get(edge.source);
                    const tgt = nodeById.get(edge.target);
                    return (
                      <div key={edge.id} className="text-[10px] text-gray-500 py-1.5 flex items-center gap-1.5">
                        <span className="text-gray-400">{src?.data?.name || '?'}</span>
                        <svg className="w-3 h-3 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        <span className="text-gray-400">{tgt?.data?.name || '?'}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Block detail */
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ backgroundColor: (currentBlockDef?.color || '#6b7280') + '15' }}
                >
                  {currentBlockDef?.icon || '📦'}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-th-primary">
                    {currentNodeData?.name || currentBlockDef?.label}
                  </h2>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                    {currentBlockDef?.label}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {renderPresentationDetails(currentNodeData)}
              </div>

              {currentNodeData?.notes && (
                <div className="mt-6 p-3 rounded-lg bg-rumi-dark/50 border border-rumi-border group">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs font-medium text-th-muted uppercase tracking-wider">Notes</div>
                    <CopyButton text={currentNodeData.notes} />
                  </div>
                  <p className="text-xs text-gray-400 whitespace-pre-wrap">{currentNodeData.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Navigation controls */}
          <div className="p-4 border-t border-rumi-border flex items-center justify-between">
            <button
              onClick={() => setCurrentStep((s) => Math.max(s - 1, -1))}
              disabled={currentStep <= -1}
              className="rumi-btn-ghost text-xs disabled:opacity-30"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex gap-1">
              {/* Overview dot */}
              <button
                onClick={() => setCurrentStep(-1)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  currentStep === -1 ? 'bg-rumi-accent' : 'bg-rumi-border hover:bg-gray-500'
                }`}
              />
              {orderedNodes.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentStep(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    currentStep === i ? 'bg-rumi-accent' : 'bg-rumi-border hover:bg-gray-500'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={() => setCurrentStep((s) => Math.min(s + 1, totalSteps - 1))}
              disabled={currentStep >= totalSteps - 1}
              className="rumi-btn-ghost text-xs disabled:opacity-30"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Keyboard hint */}
          <div className="px-4 pb-3 text-center">
            <p className="text-xs text-th-faint">
              Use arrow keys or spacebar to navigate. Esc to exit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
      title="Copy to clipboard"
    >
      {copied ? (
        <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

function renderPresentationDetails(data) {
  if (!data) return null;

  const fields = [];

  switch (data.blockType) {
    case 'llm':
      if (data.provider) fields.push({ label: 'Provider', value: data.provider });
      if (data.model) fields.push({ label: 'Model', value: data.model });
      fields.push({ label: 'Temperature', value: String(data.temperature ?? 0.7) });
      fields.push({ label: 'Max Tokens', value: String(data.maxTokens || 4096) });
      break;
    case 'knowledge':
      if (data.sourceType) fields.push({ label: 'Source Type', value: data.sourceType });
      if (data.description) fields.push({ label: 'Description', value: data.description });
      if (data.files?.length) fields.push({ label: 'Files', value: data.files.join('\n'), mono: true });
      if (data.urls?.length) fields.push({ label: 'URLs', value: data.urls.join('\n'), mono: true });
      break;
    case 'instructions':
      if (data.persona) fields.push({ label: 'Persona', value: data.persona });
      if (data.instructions) fields.push({ label: 'Instructions', value: data.instructions, long: true });
      if (data.tone) fields.push({ label: 'Tone', value: data.tone });
      if (data.constraints?.length) fields.push({ label: 'Constraints', value: data.constraints.join('\n'), mono: true });
      break;
    case 'tools':
      if (data.description) fields.push({ label: 'Description', value: data.description });
      if (data.toolList?.length) fields.push({ label: 'Tools', value: data.toolList.join('\n'), mono: true });
      if (data.apiEndpoints?.length) fields.push({ label: 'API Endpoints', value: data.apiEndpoints.join('\n'), mono: true });
      break;
    case 'memory':
      fields.push({ label: 'Type', value: data.memoryType || 'conversation' });
      fields.push({ label: 'Window Size', value: String(data.windowSize || 10) });
      break;
    case 'guardrails':
      if (data.rules?.length) fields.push({ label: 'Rules', value: data.rules.join('\n'), mono: true });
      if (data.blockedTopics?.length) fields.push({ label: 'Blocked Topics', value: data.blockedTopics.join('\n'), mono: true });
      if (data.outputFormat) fields.push({ label: 'Output Format', value: data.outputFormat });
      break;
    case 'input':
    case 'output':
      fields.push({
        label: 'Type',
        value: data.blockType === 'input' ? (data.inputType || 'chat') : (data.outputType || 'chat'),
      });
      fields.push({ label: 'Format', value: data.format || 'text' });
      if (data.description) fields.push({ label: 'Description', value: data.description, long: true });
      break;
    case 'loop':
      fields.push({ label: 'Loop Type', value: data.loopType || 'forEach' });
      if (data.maxIterations) fields.push({ label: 'Max Iterations', value: String(data.maxIterations) });
      break;
    case 'agentIntro':
      if (data.agentTitle) fields.push({ label: 'Agent Title', value: data.agentTitle });
      if (data.agentDescription) fields.push({ label: 'Agent Description', value: data.agentDescription, long: true });
      if (data.userInstructions) fields.push({ label: 'AI Instructions', value: data.userInstructions, long: true });
      break;
    case 'fileResources': {
      const resources = (data.resources || []).filter((r) => r?.url);
      if (resources.length) {
        fields.push({
          label: 'Resources',
          value: resources.map((r) => `${r.url}${r.description ? `\n  ${r.description}` : ''}`).join('\n'),
          mono: true,
        });
      }
      break;
    }
    case 'subagent':
      if (data.linkedAgentName) fields.push({ label: 'Linked Agent', value: data.linkedAgentName });
      break;
    case 'connector':
      if (data.handoffRules) fields.push({ label: 'Handoff Rules', value: data.handoffRules, long: true });
      if (data.dataPassthrough?.length) fields.push({ label: 'Data Passthrough', value: data.dataPassthrough.join('\n'), mono: true });
      if (data.errorHandling) fields.push({ label: 'Error Handling', value: data.errorHandling, long: true });
      break;
    case 'condition':
      if (data.conditions?.length) fields.push({ label: 'Conditions', value: data.conditions.join('\n'), mono: true });
      if (data.defaultRoute) fields.push({ label: 'Default Route', value: data.defaultRoute });
      break;
    case 'variable':
      if (data.variables?.length) fields.push({ label: 'Variables', value: data.variables.join('\n'), mono: true });
      break;
    default:
      if (data.description) fields.push({ label: 'Description', value: data.description });
  }

  return fields.map((f, i) => (
    <div key={i} className="group">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-medium text-th-muted uppercase tracking-wider">
          {f.label}
        </div>
        <CopyButton text={f.value} />
      </div>
      {f.mono ? (
        <pre className="text-sm text-th-secondary bg-rumi-dark/50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono">
          {f.value}
        </pre>
      ) : f.long ? (
        <p className="text-sm text-th-secondary whitespace-pre-wrap leading-relaxed">{f.value}</p>
      ) : (
        <p className="text-sm text-th-primary whitespace-pre-wrap">{f.value}</p>
      )}
    </div>
  ));
}
