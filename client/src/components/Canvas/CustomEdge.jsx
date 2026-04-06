import React, { useEffect, useState } from 'react';
import {
  getSmoothStepPath,
  getBezierPath,
  EdgeLabelRenderer,
} from '@xyflow/react';
import { CONNECTION_TYPES } from '../../utils/blockTypes';

const ARROW_DIRECTIONS = [
  { key: 'forward', label: 'Source → Target', icon: '→' },
  { key: 'reverse', label: 'Target → Source', icon: '←' },
  { key: 'both', label: 'Bidirectional', icon: '↔' },
];

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  style = {},
}) {
  const [showMenu, setShowMenu] = useState(false);
  const connectionType = data?.connectionType || 'data';
  const arrowDirection = data?.arrowDirection || 'forward';
  const connDef = CONNECTION_TYPES[connectionType] || CONNECTION_TYPES.data;

  // Use smooth step for most, bezier for handoff
  // borderRadius gives cleaner rounded corners on orthogonal paths
  const pathFn = connectionType === 'handoff' ? getBezierPath : getSmoothStepPath;
  const pathParams = {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  };
  if (connectionType !== 'handoff') {
    pathParams.borderRadius = 12;
  }
  const [edgePath, labelX, labelY] = pathFn(pathParams);

  // Build stroke dash based on connection style
  let strokeDasharray;
  if (connDef.style === 'dashed') strokeDasharray = '8 4';
  else if (connDef.style === 'dotted') strokeDasharray = '3 3';

  const edgeColor = selected ? '#0ea5e9' : connDef.color;

  const edgeStyle = {
    stroke: edgeColor,
    strokeWidth: selected ? 3 : 2,
    strokeDasharray,
    ...style,
  };

  // Determine markers based on arrow direction
  const markerEnd = (arrowDirection === 'forward' || arrowDirection === 'both')
    ? `url(#arrow-${selected ? 'selected' : connectionType})`
    : undefined;
  const markerStart = (arrowDirection === 'reverse' || arrowDirection === 'both')
    ? `url(#arrow-${selected ? 'selected' : connectionType})`
    : undefined;

  useEffect(() => {
    if (!showMenu) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setShowMenu(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showMenu]);

  return (
    <>
      {/* Invisible wider path for easier click target */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="cursor-pointer"
      />

      {/* Visible edge path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        style={edgeStyle}
        className={connDef.animated ? 'animated-edge' : ''}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />

      {/* Edge label with connection type */}
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            zIndex: showMenu ? 1000 : 1,
            opacity: 1,
          }}
        >
          {/* Label pill */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className={`text-[9px] px-2 py-0.5 rounded-full border transition-all whitespace-nowrap
              ${selected
                ? 'bg-rumi-accent/10 border-rumi-accent/30 text-rumi-accent'
                : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-700'
              }`}
            style={{ fontSize: '9px' }}
          >
            {ARROW_DIRECTIONS.find(d => d.key === arrowDirection)?.icon || '→'} {connDef.label}
          </button>

          {/* Connection type selector dropdown — positioned ABOVE */}
          {showMenu && (
            <ConnectionTypeMenu
              currentType={connectionType}
              currentDirection={arrowDirection}
              onSelectType={(type) => {
                if (data?.onChange) data.onChange(id, type);
              }}
              onSelectDirection={(direction) => {
                if (data?.onDirectionChange) data.onDirectionChange(id, direction);
              }}
              onClose={() => setShowMenu(false)}
            />
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

function ConnectionTypeMenu({ currentType, currentDirection, onSelectType, onSelectDirection, onClose }) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0" style={{ zIndex: 999 }} onClick={onClose} />

      {/* Menu — positioned ABOVE the label pill */}
      <div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px]"
        style={{ zIndex: 1000 }}
      >
        {/* Connection Type Section */}
        <div className="px-3 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wider">
          Connection Type
        </div>
        {Object.entries(CONNECTION_TYPES).map(([key, def]) => (
          <button
            key={key}
            onClick={(e) => {
              e.stopPropagation();
              onSelectType(key);
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors
              ${key === currentType
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-50'
              }`}
          >
            {/* Line preview */}
            <svg width="28" height="10" className="shrink-0">
              <line
                x1="0" y1="5" x2="28" y2="5"
                stroke={def.color}
                strokeWidth="2"
                strokeDasharray={
                  def.style === 'dashed' ? '6 3' :
                  def.style === 'dotted' ? '2 2' : 'none'
                }
              />
            </svg>
            <span>{def.label}</span>
            {key === currentType && (
              <svg className="w-3 h-3 ml-auto text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        ))}

        {/* Divider */}
        <div className="border-t border-gray-100 my-1" />

        {/* Arrow Direction Section */}
        <div className="px-3 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wider">
          Arrow Direction
        </div>
        {ARROW_DIRECTIONS.map((dir) => (
          <button
            key={dir.key}
            onClick={(e) => {
              e.stopPropagation();
              onSelectDirection(dir.key);
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors
              ${dir.key === currentDirection
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-50'
              }`}
          >
            <span className="text-sm w-7 text-center shrink-0">{dir.icon}</span>
            <span>{dir.label}</span>
            {dir.key === currentDirection && (
              <svg className="w-3 h-3 ml-auto text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </>
  );
}

// Arrow marker definition component - renders markers for each connection type + selected state
export function EdgeArrowMarker() {
  const colors = {
    data: CONNECTION_TYPES.data.color,
    control: CONNECTION_TYPES.control.color,
    reference: CONNECTION_TYPES.reference.color,
    handoff: CONNECTION_TYPES.handoff.color,
    selected: '#0ea5e9',
  };

  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        {Object.entries(colors).map(([key, color]) => (
          <marker
            key={key}
            id={`arrow-${key}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
          </marker>
        ))}
      </defs>
    </svg>
  );
}
