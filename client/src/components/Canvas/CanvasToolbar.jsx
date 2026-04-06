import React, { useState, useRef, useEffect } from 'react';
import { PresenceIndicator } from '../Collaboration/CollaboratorCursors';

export default function CanvasToolbar({ buildName, onNameChange, onSave, saving, isDirty, onExport, onPresent, onShare, onComments, showComments, onActivity, showActivity, onAutoLayout, onBack, nodeCount, edgeCount, collaborators, collabConnected }) {
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(buildName);
  const inputRef = useRef();

  useEffect(() => {
    setName(buildName);
  }, [buildName]);

  const handleSubmit = () => {
    const trimmed = name.trim() || 'Untitled Agent';
    onNameChange(trimmed);
    setEditing(false);
  };

  return (
    <div className="min-h-11 flex items-center justify-between gap-2 pl-2 pr-2 sm:px-4 border-b border-rumi-border bg-rumi-shell shrink-0 min-w-0">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
        <button
          type="button"
          onClick={onBack}
          className="text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1 shrink-0 rounded-md rumi-touch-sm sm:min-h-0 sm:min-w-0 px-2 -ml-1"
          aria-label="Back to dashboard"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-xs hidden sm:inline">Back</span>
        </button>

        <div className="h-4 w-px bg-rumi-border" />

        {editing ? (
          <input
            ref={inputRef}
            type="text"
            className="bg-transparent text-sm font-medium text-th-primary border-b border-rumi-accent outline-none px-1 py-0.5 min-w-0 w-full max-w-[min(100%,14rem)] sm:max-w-xs"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') { setName(buildName); setEditing(false); }
            }}
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.select(), 10); }}
            className="text-sm font-medium text-gray-200 hover:text-white transition-colors flex items-center gap-1.5 min-w-0 text-left max-w-[min(100%,180px)] sm:max-w-[240px] md:max-w-md truncate"
          >
            {buildName}
            <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
        )}

        {isDirty && (
          <span className="text-[10px] text-yellow-500/70">unsaved</span>
        )}

        {/* Block/edge count */}
        <div className="hidden md:flex items-center gap-2 text-[10px] text-gray-600 ml-2">
          <span>{nodeCount || 0} block{(nodeCount || 0) !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{edgeCount || 0} connection{(edgeCount || 0) !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 rumi-scroll-x max-w-[min(100%,56vw)] sm:max-w-[min(100%,48vw)] md:max-w-none flex-shrink-0 pl-1 -mr-1">
        {/* Collaborators presence */}
        {collaborators && <PresenceIndicator collaborators={collaborators} />}

        {collabConnected && collaborators?.length > 1 && (
          <div className="h-4 w-px bg-rumi-border mx-1 shrink-0 hidden sm:block" />
        )}

        {/* Auto Layout button */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowLayoutMenu((s) => !s)}
            className="rumi-btn-ghost text-xs flex items-center gap-1.5 min-h-[40px] sm:min-h-0 px-2"
            title="Auto Layout"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
              />
            </svg>
            <span className="hidden sm:inline">Layout</span>
          </button>
          {showLayoutMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowLayoutMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 bg-rumi-shell rounded-lg shadow-lg border border-rumi-border py-1 min-w-[160px]">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-th-muted uppercase tracking-wider">
                  Auto Layout
                </div>
                <button
                  type="button"
                  onClick={() => { onAutoLayout('TB'); setShowLayoutMenu(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm text-th-secondary hover:bg-white/5"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  Top to Bottom
                </button>
                <button
                  type="button"
                  onClick={() => { onAutoLayout('LR'); setShowLayoutMenu(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm text-th-secondary hover:bg-white/5"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                  Left to Right
                </button>
              </div>
            </>
          )}
        </div>

        {/* Comments button */}
        <button
          type="button"
          onClick={onComments}
          className={`rumi-btn-ghost text-xs flex items-center gap-1.5 shrink-0 min-h-[40px] sm:min-h-0 px-2 ${showComments ? 'text-rumi-accent' : ''}`}
          title="Comments"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          <span className="hidden sm:inline">Comments</span>
        </button>

        {/* Activity log button */}
        <button
          type="button"
          onClick={onActivity}
          className={`rumi-btn-ghost text-xs flex items-center gap-1.5 shrink-0 min-h-[40px] sm:min-h-0 px-2 ${showActivity ? 'text-rumi-accent' : ''}`}
          title="Activity Log"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="hidden sm:inline">Activity</span>
        </button>

        {/* Share button */}
        <button
          type="button"
          onClick={onShare}
          className="rumi-btn-ghost text-xs flex items-center gap-1.5 shrink-0 min-h-[40px] sm:min-h-0 px-2"
          title="Share"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span className="hidden sm:inline">Share</span>
        </button>

        {/* Present button */}
        <button
          type="button"
          onClick={onPresent}
          className="rumi-btn-ghost text-xs flex items-center gap-1.5 shrink-0 min-h-[40px] sm:min-h-0 px-2"
          title="Presentation mode"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
            />
          </svg>
          <span className="hidden sm:inline">Present</span>
        </button>

        {/* Export button */}
        <button
          type="button"
          onClick={onExport}
          className="rumi-btn-ghost text-xs flex items-center gap-1.5 shrink-0 min-h-[40px] sm:min-h-0 px-2"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          <span className="hidden sm:inline">Export</span>
        </button>

        {/* Save button */}
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !isDirty}
          className="rumi-btn-primary text-xs flex items-center gap-1.5 shrink-0 min-h-[40px] sm:min-h-0 px-3"
        >
          {saving ? (
            <>
              <div className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save
            </>
          )}
        </button>
      </div>
    </div>
  );
}
