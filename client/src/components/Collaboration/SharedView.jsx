import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { sharingApi } from '../../utils/api';
import { userFacingError } from '../../utils/userFacingError';
import { BLOCK_TYPES } from '../../utils/blockTypes';
import AgentBlockNode from '../Blocks/AgentBlockNode';
import CustomEdge, { EdgeArrowMarker } from '../Canvas/CustomEdge';
import useAuthStore from '../../stores/authStore';

const nodeTypes = { agentBlock: AgentBlockNode };
const edgeTypes = { custom: CustomEdge };

export default function SharedView() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [agent, setAgent] = useState(null);
  const [permission, setPermission] = useState('view');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');
      setAgent(null);
      setPermission('view');

      try {
        const data = await sharingApi.getShared(token);
        if (cancelled) return;

        setAgent(data.agent);
        setPermission(data.permission || 'view');

        if (data.permission === 'edit' && user?.id && data.agent?.id) {
          navigate(`/agent/${data.agent.id}`, { replace: true });
          return;
        }
      } catch (err) {
        if (!cancelled) {
          setError(userFacingError(err, 'Could not open this shared link.'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [token, user?.id, navigate]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-rumi-dark">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-rumi-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading shared agent...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-rumi-dark">
        <div className="text-center max-w-sm px-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-th-primary mb-2">Cannot access this agent</h2>
          <p className="text-gray-500 text-sm">{error}</p>
          {!user && (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="rumi-btn-primary mt-4 text-sm"
            >
              Sign in to access
            </button>
          )}
        </div>
      </div>
    );
  }

  const nodes = agent?.canvas_data?.nodes || [];
  const edges = (agent?.canvas_data?.edges || []).map((e) => ({
    ...e,
    type: 'custom',
    data: { ...e.data, onChange: () => {} },
  }));

  return (
    <div className="h-screen flex flex-col bg-rumi-dark">
      {/* Header bar */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-rumi-border bg-rumi-shell shrink-0 z-50">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-rumi-accent text-sm font-semibold shrink-0">RUMI</span>
          <span className="text-gray-500 text-sm hidden sm:inline">Agent Builder</span>
          <div className="h-4 w-px bg-rumi-border mx-2 shrink-0" />
          <span className="text-sm font-medium text-gray-200 truncate">{agent?.name}</span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
            permission === 'edit' ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-500/10 text-gray-400'
          }`}>
            {permission} access
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-xs text-gray-500 truncate max-w-[40vw] sm:max-w-none">
            Shared by {agent?.owner_name || agent?.owner_email}
          </div>
          {!user && (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="rumi-btn-primary text-xs"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* Canvas */}
      <div className="flex-1 relative min-h-0">
        <EdgeArrowMarker />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="var(--rumi-canvas-dots)"
          />
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
      </div>
    </div>
  );
}
