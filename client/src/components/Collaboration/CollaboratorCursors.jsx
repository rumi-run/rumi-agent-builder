import React from 'react';

// Assign consistent colors to collaborators
const COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316',
];

function getColor(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitial(name, email) {
  // Use first letter of email username
  const str = name || email || '';
  const emailPart = str.split('@')[0];
  return emailPart?.[0]?.toUpperCase() || '?';
}

export function CollaboratorCursors({ cursors }) {
  return (
    <>
      {Object.entries(cursors).map(([userId, { x, y, userName }]) => (
        <div
          key={userId}
          className="absolute pointer-events-none z-50 transition-all duration-100"
          style={{ left: x, top: y, transform: 'translate(-2px, -2px)' }}
        >
          {/* Cursor arrow */}
          <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
            <path
              d="M1 1L6 18L8.5 10.5L15 8L1 1Z"
              fill={getColor(userId)}
              stroke="white"
              strokeWidth="1"
            />
          </svg>
          {/* Name label */}
          <div
            className="absolute top-4 left-3 px-1.5 py-0.5 rounded text-[9px] font-medium text-white whitespace-nowrap"
            style={{ backgroundColor: getColor(userId) }}
          >
            {userName?.split('@')[0] || 'User'}
          </div>
        </div>
      ))}
    </>
  );
}

export function PresenceIndicator({ collaborators }) {
  if (!collaborators || collaborators.length <= 1) return null;

  return (
    <div className="flex items-center gap-1">
      <div className="flex -space-x-1.5">
        {collaborators.slice(0, 5).map((user) => (
          <div
            key={user.userId}
            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2 border-rumi-shell"
            style={{ backgroundColor: getColor(user.userId) }}
            title={user.userEmail || user.userName}
          >
            {getInitial(user.userName, user.userEmail)}
          </div>
        ))}
      </div>
      {collaborators.length > 5 && (
        <span className="text-[10px] text-gray-500 ml-1">
          +{collaborators.length - 5}
        </span>
      )}
      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-1" />
      <span className="text-[10px] text-gray-500">
        {collaborators.length} online
      </span>
    </div>
  );
}

export function NodeSelectionOverlay({ selections, nodes }) {
  return (
    <>
      {Object.entries(selections).map(([userId, { nodeId, userName }]) => {
        const node = nodes?.find((n) => n.id === nodeId);
        if (!node) return null;
        const color = getColor(userId);
        return (
          <div
            key={userId}
            className="absolute pointer-events-none z-40"
            style={{
              left: node.position?.x - 4,
              top: node.position?.y - 4,
              width: (node.measured?.width || 200) + 8,
              height: (node.measured?.height || 80) + 8,
            }}
          >
            <div
              className="w-full h-full rounded-xl border-2"
              style={{ borderColor: color, boxShadow: `0 0 8px ${color}40` }}
            />
            <div
              className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[8px] font-medium text-white"
              style={{ backgroundColor: color }}
            >
              {userName?.split('@')[0]}
            </div>
          </div>
        );
      })}
    </>
  );
}
