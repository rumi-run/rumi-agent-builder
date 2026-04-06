import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { BLOCK_TYPES } from '../../utils/blockTypes';
import useCanvasStore from '../../stores/canvasStore';

const baseHandleStyle = "!w-4 !h-4 !border-2 !border-white !bg-gray-400 hover:!bg-rumi-accent !transition-all !duration-200";

function AgentBlockNode({ id, data, selected }) {
  const handleStyle = `${baseHandleStyle} ${selected ? '!opacity-100' : '!opacity-70 group-hover:!opacity-100'}`;

  const openDetailPanel = useCanvasStore((s) => s.openDetailPanel);
  const blockDef = BLOCK_TYPES[data.blockType] || {};

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    openDetailPanel(id);
  };

  if (data.blockType === 'agentIntro') {
    const title = (data.agentTitle || data.name || blockDef.label || 'Agent Intro').trim();
    const description = (data.agentDescription || '').trim();

    return (
      <div
        className="group"
        onDoubleClick={handleDoubleClick}
      >
        {description ? (
          <div className="min-w-[340px] max-w-[560px] px-1 py-1 text-slate-800">
            <div className="text-[20px] font-bold leading-tight break-words">
              {title}
            </div>
            <div className="mt-2 text-[14px] leading-7 whitespace-pre-wrap break-words">
              {description}
            </div>
          </div>
        ) : (
          <div className="min-w-[340px] max-w-[560px] rounded-xl border-2 border-dashed border-slate-300 bg-white/75 px-4 py-5 text-sm text-slate-500">
            Double-click to generate Agent Intro with AI
          </div>
        )}
      </div>
    );
  }

  if (data.blockType === 'fileResources') {
    const title = (data.name || blockDef.label || 'File Resources').trim();
    const resources = Array.isArray(data.resources) ? data.resources : [];

    return (
      <div
        className="group"
        onDoubleClick={handleDoubleClick}
      >
        {resources.length > 0 ? (
          <div className="min-w-[340px] max-w-[560px] px-1 py-1 text-slate-800">
            <div className="text-[20px] font-bold leading-tight break-words">
              {title}
            </div>
            <div className="mt-2 space-y-1 text-[14px] leading-7">
              {resources.map((r, i) => {
                const text = (r?.description || r?.url || r?.name || 'Untitled resource').toString();
                return (
                  <div key={`${text}-${i}`} className="break-words">
                    {text}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="min-w-[340px] max-w-[560px] rounded-xl border-2 border-dashed border-slate-300 bg-white/75 px-4 py-5 text-sm text-slate-500">
            Double-click to add file resources
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`agent-block group ${selected ? 'selected' : ''}`}
      style={{ borderColor: blockDef.borderColor || '#d1d5db' }}
      onDoubleClick={handleDoubleClick}
    >
      {/* 4 Handles: Top, Bottom, Left, Right */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className={handleStyle}
        style={{ top: -6 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className={handleStyle}
        style={{ left: -6 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className={handleStyle}
        style={{ right: -6 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={handleStyle}
        style={{ bottom: -6 }}
      />

      {/* Header */}
      <div className="block-header" style={{ color: blockDef.color || '#374151' }}>
        <div
          className="block-icon"
          style={{ backgroundColor: (blockDef.color || '#6b7280') + '15' }}
        >
          {blockDef.icon || '📦'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="truncate">{data.name || blockDef.label}</div>
          <div className="text-[10px] font-normal opacity-60 truncate">
            {blockDef.label}
          </div>
        </div>
      </div>

      {/* Description */}
      {blockDef.description && (
        <div className="block-description">
          {blockDef.description}
        </div>
      )}

      {/* Body preview — configuration summary */}
      <div className="block-body">
        {renderBlockPreview(data)}
      </div>
    </div>
  );
}

function renderBlockPreview(data) {
  switch (data.blockType) {
    case 'llm':
      return (
        <div className="block-config-list">
          {data.provider && (
            <div className="config-row">
              <span className="config-label">Provider</span>
              <span className="config-value">{data.provider}</span>
            </div>
          )}
          {data.model && (
            <div className="config-row">
              <span className="config-label">Model</span>
              <span className="config-value">{data.model}</span>
            </div>
          )}
          {(data.temperature !== undefined && data.temperature !== null) && (
            <div className="config-row">
              <span className="config-label">Temp</span>
              <span className="config-value">{data.temperature}</span>
            </div>
          )}
          {data.maxTokens && (
            <div className="config-row">
              <span className="config-label">Tokens</span>
              <span className="config-value">{data.maxTokens.toLocaleString()}</span>
            </div>
          )}
          {!data.provider && !data.model && (
            <span className="italic text-gray-400">Double-click to configure model</span>
          )}
        </div>
      );
    case 'knowledge':
      return (
        <div className="block-config-list">
          {data.sourceType && (
            <div className="config-row">
              <span className="config-label">Source</span>
              <span className="config-value">{data.sourceType}</span>
            </div>
          )}
          {data.description && (
            <div className="config-row">
              <span className="config-label">Info</span>
              <span className="config-value line-clamp-2">{data.description}</span>
            </div>
          )}
          {data.files?.length > 0 && (
            <div className="config-row">
              <span className="config-label">Files</span>
              <span className="config-value">{data.files.length} file(s)</span>
            </div>
          )}
          {data.urls?.length > 0 && (
            <div className="config-row">
              <span className="config-label">URLs</span>
              <span className="config-value">{data.urls.length} URL(s)</span>
            </div>
          )}
          {!data.description && !data.files?.length && !data.urls?.length && (
            <span className="italic text-gray-400">Double-click to add sources</span>
          )}
        </div>
      );
    case 'instructions':
      return (
        <div className="block-config-list">
          {data.persona && (
            <div className="config-row">
              <span className="config-label">Persona</span>
              <span className="config-value line-clamp-1">{data.persona}</span>
            </div>
          )}
          {data.instructions && (
            <div className="config-text line-clamp-3">{data.instructions}</div>
          )}
          {data.tone && (
            <div className="config-row">
              <span className="config-label">Tone</span>
              <span className="config-value">{data.tone}</span>
            </div>
          )}
          {data.constraints?.length > 0 && (
            <div className="config-row">
              <span className="config-label">Constraints</span>
              <span className="config-value">{data.constraints.length} rule(s)</span>
            </div>
          )}
          {!data.instructions && !data.persona && (
            <span className="italic text-gray-400">Double-click to write instructions</span>
          )}
        </div>
      );
    case 'tools':
      return (
        <div className="block-config-list">
          {data.description && (
            <div className="config-text line-clamp-2">{data.description}</div>
          )}
          {data.toolList?.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {data.toolList.slice(0, 6).map((tool, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded text-[10px]">
                  {tool}
                </span>
              ))}
              {data.toolList.length > 6 && (
                <span className="text-[10px] text-gray-400">+{data.toolList.length - 6}</span>
              )}
            </div>
          ) : null}
          {data.apiEndpoints?.length > 0 && (
            <div className="config-row">
              <span className="config-label">APIs</span>
              <span className="config-value">{data.apiEndpoints.length} endpoint(s)</span>
            </div>
          )}
          {!data.toolList?.length && !data.description && (
            <span className="italic text-gray-400">Double-click to add tools</span>
          )}
        </div>
      );
    case 'memory':
      return (
        <div className="block-config-list">
          <div className="config-row">
            <span className="config-label">Type</span>
            <span className="config-value">{data.memoryType || 'conversation'}</span>
          </div>
          {data.windowSize && (
            <div className="config-row">
              <span className="config-label">Window</span>
              <span className="config-value">{data.windowSize} messages</span>
            </div>
          )}
        </div>
      );
    case 'guardrails':
      return (
        <div className="block-config-list">
          {data.rules?.length > 0 ? (
            <div className="config-row">
              <span className="config-label">Rules</span>
              <span className="config-value">{data.rules.length} rule(s)</span>
            </div>
          ) : null}
          {data.blockedTopics?.length > 0 && (
            <div className="config-row">
              <span className="config-label">Blocked</span>
              <span className="config-value">{data.blockedTopics.length} topic(s)</span>
            </div>
          )}
          {data.outputFormat && (
            <div className="config-row">
              <span className="config-label">Format</span>
              <span className="config-value">{data.outputFormat}</span>
            </div>
          )}
          {!data.rules?.length && !data.blockedTopics?.length && (
            <span className="italic text-gray-400">Double-click to set rules</span>
          )}
        </div>
      );
    case 'input':
    case 'output':
      return (
        <div className="block-config-list">
          <div className="config-row">
            <span className="config-label">Type</span>
            <span className="config-value">{data.inputType || data.outputType || 'chat'}</span>
          </div>
          <div className="config-row">
            <span className="config-label">Format</span>
            <span className="config-value">{data.format || 'text'}</span>
          </div>
          {data.description && (
            <div className="config-text line-clamp-2">{data.description}</div>
          )}
        </div>
      );
    case 'subagent':
      return (
        <div className="block-config-list">
          {data.linkedAgentName ? (
            <div className="config-row">
              <span className="config-label">Agent</span>
              <span className="config-value">{data.linkedAgentName}</span>
            </div>
          ) : (
            <span className="italic text-gray-400">Double-click to link agent</span>
          )}
        </div>
      );
    case 'connector':
      return (
        <div className="block-config-list">
          {data.handoffRules && (
            <div className="config-text line-clamp-3">{data.handoffRules}</div>
          )}
          {data.dataPassthrough?.length > 0 && (
            <div className="config-row">
              <span className="config-label">Passthrough</span>
              <span className="config-value">{data.dataPassthrough.length} field(s)</span>
            </div>
          )}
          {data.errorHandling && (
            <div className="config-row">
              <span className="config-label">On Error</span>
              <span className="config-value line-clamp-1">{data.errorHandling}</span>
            </div>
          )}
          {!data.handoffRules && (
            <span className="italic text-gray-400">Double-click to define handoff</span>
          )}
        </div>
      );
    case 'condition':
      return (
        <div className="block-config-list">
          {data.conditions?.length > 0 ? (
            <div className="config-row">
              <span className="config-label">Rules</span>
              <span className="config-value">{data.conditions.length} condition(s)</span>
            </div>
          ) : null}
          {data.defaultRoute && (
            <div className="config-row">
              <span className="config-label">Default</span>
              <span className="config-value">{data.defaultRoute}</span>
            </div>
          )}
          {!data.conditions?.length && !data.defaultRoute && (
            <span className="italic text-gray-400">Double-click to set conditions</span>
          )}
        </div>
      );
    case 'variable':
      return (
        <div className="block-config-list">
          {data.variables?.length > 0 ? (
            <>
              <div className="config-row">
                <span className="config-label">Count</span>
                <span className="config-value">{data.variables.length} variable(s)</span>
              </div>
              {data.variables.slice(0, 3).map((v, i) => (
                <div key={i} className="text-[10px] font-mono text-gray-500 truncate">{v}</div>
              ))}
              {data.variables.length > 3 && (
                <div className="text-[10px] text-gray-400">+{data.variables.length - 3} more</div>
              )}
            </>
          ) : (
            <span className="italic text-gray-400">Double-click to define variables</span>
          )}
        </div>
      );
    case 'loop':
      return (
        <div className="block-config-list">
          <div className="config-row">
            <span className="config-label">Type</span>
            <span className="config-value">{data.loopType || 'forEach'}</span>
          </div>
          {data.maxIterations && (
            <div className="config-row">
              <span className="config-label">Max</span>
              <span className="config-value">{data.maxIterations} iterations</span>
            </div>
          )}
        </div>
      );
    case 'agentIntro':
      return (
        <div className="block-config-list">
          {data.agentTitle && (
            <div className="config-row">
              <span className="config-label">Title</span>
              <span className="config-value font-semibold">{data.agentTitle}</span>
            </div>
          )}
          {data.agentDescription && (
            <div className="config-text line-clamp-4 text-[11px] leading-relaxed">{data.agentDescription}</div>
          )}
          {!data.agentTitle && !data.agentDescription && (
            <span className="italic text-gray-400">Double-click to generate intro with AI</span>
          )}
        </div>
      );
    case 'fileResources':
      return (
        <div className="block-config-list">
          {data.resources?.length > 0 ? (
            <>
              <div className="config-row">
                <span className="config-label">Files</span>
                <span className="config-value">{data.resources.length} resource(s)</span>
              </div>
              {data.resources.slice(0, 3).map((r, i) => (
                <div key={i} className="text-[10px] text-gray-500 truncate">
                  {r.description || r.url || 'Untitled resource'}
                </div>
              ))}
              {data.resources.length > 3 && (
                <div className="text-[10px] text-gray-400">+{data.resources.length - 3} more</div>
              )}
            </>
          ) : (
            <span className="italic text-gray-400">Double-click to add file resources</span>
          )}
        </div>
      );
    default:
      return (
        <span className="italic text-gray-400">
          {data.description || data.notes || 'Double-click to edit'}
        </span>
      );
  }
}

export default memo(AgentBlockNode);
