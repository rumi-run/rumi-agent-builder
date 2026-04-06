import React, { useState } from 'react';
import { BLOCK_TYPES, BLOCK_CATEGORIES } from '../../utils/blockTypes';

export default function BlockPalette() {
  const [activeCategory, setActiveCategory] = useState('core');
  const [collapsed, setCollapsed] = useState(false);

  const categoryBlocks = Object.entries(BLOCK_TYPES).filter(
    ([, def]) => def.category === activeCategory
  );

  const onDragStart = (e, blockType) => {
    e.dataTransfer.setData('application/rumi-block-type', blockType);
    e.dataTransfer.effectAllowed = 'move';
  };

  if (collapsed) {
    return (
      <div className="w-12 bg-rumi-shell border-r border-rumi-border flex flex-col items-center py-3">
        <button
          onClick={() => setCollapsed(false)}
          className="w-8 h-8 rounded-lg bg-rumi-sidebar hover:bg-rumi-border flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          title="Expand palette"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <div className="mt-4 flex flex-col gap-2">
          {Object.entries(BLOCK_TYPES).slice(0, 6).map(([key, def]) => (
            <div
              key={key}
              draggable
              onDragStart={(e) => onDragStart(e, key)}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
              style={{ backgroundColor: def.color + '15' }}
              title={def.label}
            >
              <span className="text-sm">{def.icon}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-rumi-shell border-r border-rumi-border flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-rumi-border">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Blocks</span>
        <button
          onClick={() => setCollapsed(true)}
          className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
          title="Collapse palette"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-rumi-border">
        {Object.entries(BLOCK_CATEGORIES).map(([key, cat]) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              activeCategory === key
                ? 'bg-rumi-accent/10 text-rumi-accent'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Block list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {categoryBlocks.map(([key, def]) => (
          <div
            key={key}
            draggable
            onDragStart={(e) => onDragStart(e, key)}
            className="flex items-start gap-3 p-3 rounded-lg border border-transparent hover:border-rumi-border bg-rumi-sidebar/50 hover:bg-rumi-sidebar cursor-grab active:cursor-grabbing transition-all group"
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-base group-hover:scale-110 transition-transform"
              style={{ backgroundColor: def.color + '15' }}
            >
              {def.icon}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-gray-200 truncate">
                {def.label}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">
                {def.description}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Help text */}
      <div className="px-4 py-3 border-t border-rumi-border">
        <p className="text-[10px] text-gray-600 leading-relaxed">
          Drag blocks onto the canvas to build your agent structure.
          Double-click any block to edit its details.
        </p>
      </div>
    </div>
  );
}
