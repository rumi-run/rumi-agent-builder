import React from 'react';

const SHORTCUTS = [
  { category: 'General', shortcuts: [
    { keys: ['Ctrl', 'S'], action: 'Save agent build' },
    { keys: ['Ctrl', 'Z'], action: 'Undo last change' },
    { keys: ['Ctrl', 'Shift', 'Z'], action: 'Redo last change' },
    { keys: ['Delete'], action: 'Remove selected block' },
    { keys: ['?'], action: 'Toggle this shortcuts panel' },
  ]},
  { category: 'Canvas', shortcuts: [
    { keys: ['Scroll'], action: 'Zoom in / out' },
    { keys: ['Drag'], action: 'Pan canvas' },
    { keys: ['Double-click'], action: 'Edit block details' },
  ]},
  { category: 'Presentation', shortcuts: [
    { keys: ['→', 'Space'], action: 'Next block' },
    { keys: ['←', 'Backspace'], action: 'Previous block' },
    { keys: ['Esc'], action: 'Exit presentation' },
  ]},
];

export default function KeyboardShortcuts({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-rumi-shell border border-rumi-border rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-th-primary">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-th-primary transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5">
          {SHORTCUTS.map((group) => (
            <div key={group.category}>
              <h3 className="text-xs font-medium text-th-muted uppercase tracking-wider mb-2">
                {group.category}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <span className="text-xs text-gray-400">{s.action}</span>
                    <div className="flex gap-1">
                      {s.keys.map((key, j) => (
                        <React.Fragment key={j}>
                          {j > 0 && <span className="text-gray-600 text-xs">+</span>}
                          <kbd className="px-2 py-0.5 text-[10px] font-mono bg-rumi-dark border border-rumi-border rounded text-gray-300 min-w-[24px] text-center">
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-rumi-border text-center">
          <p className="text-[10px] text-gray-600">Press <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-rumi-dark border border-rumi-border rounded text-gray-400">?</kbd> anywhere on the canvas to toggle this panel</p>
        </div>
      </div>
    </div>
  );
}
