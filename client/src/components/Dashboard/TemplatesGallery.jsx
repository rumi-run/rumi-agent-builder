import React, { useState, useEffect, useMemo, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { AGENT_TEMPLATES, TEMPLATE_CATEGORIES } from '../../utils/templates';
import { agentApi, communityTemplatesApi } from '../../utils/api';
import { userFacingError } from '../../utils/userFacingError';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { BLOCK_TYPES } from '../../utils/blockTypes';

export default function TemplatesGallery({ onClose }) {
  const dialogTitleId = useId();
  const dialogRef = useDialogFocus(true, onClose);
  const navigate = useNavigate();
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState('all');
  const [communityTemplates, setCommunityTemplates] = useState([]);
  const [communityFetchError, setCommunityFetchError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await communityTemplatesApi.getPublic();
        if (!cancelled) {
          setCommunityTemplates(data.templates || []);
          setCommunityFetchError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setCommunityTemplates([]);
          setCommunityFetchError(userFacingError(err, 'Could not load community templates.'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const allTemplates = useMemo(
    () => [...AGENT_TEMPLATES, ...communityTemplates],
    [communityTemplates]
  );

  const filtered =
    filter === 'all'
      ? allTemplates
      : allTemplates.filter((t) => t.category === filter);

  const handleUseTemplate = async (template) => {
    setCreating(true);
    try {
      const data = await agentApi.create({
        name: template.id === 'blank' ? 'Untitled Agent' : template.name,
        description: template.description,
        canvas_data: {
          nodes: template.nodes,
          edges: template.edges,
        },
      });
      navigate(`/agent/${data.agent.id}`);
    } catch (err) {
      console.error('Failed to create from template:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 pb-[max(0px,env(safe-area-inset-bottom))]"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        className="bg-rumi-shell border border-rumi-border rounded-t-2xl sm:rounded-2xl w-full max-w-4xl max-h-[min(92vh,900px)] sm:max-h-[85vh] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-rumi-border shrink-0">
          <div className="min-w-0">
            <h2 id={dialogTitleId} className="text-lg font-semibold text-th-primary">
              Start from a Template
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Pre-built agent structures to get you started faster
            </p>
            {communityFetchError && (
              <p className="text-[11px] text-amber-400/95 mt-1.5" role="status">
                {communityFetchError} Built-in templates below still work.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rumi-touch-sm shrink-0 text-gray-500 hover:text-th-primary transition-colors rounded-lg sm:min-h-0 sm:min-w-0 p-2 -mr-1"
            aria-label="Close template gallery"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Category filter */}
        <div className="flex gap-1.5 px-4 sm:px-6 py-3 border-b border-rumi-border shrink-0 rumi-scroll-x">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              filter === 'all'
                ? 'bg-rumi-accent/10 text-rumi-accent'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            All Templates
          </button>
          {Object.entries(TEMPLATE_CATEGORIES).map(([key, label]) => (
            <button
              type="button"
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                filter === key
                  ? 'bg-rumi-accent/10 text-rumi-accent'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          {/* Template list */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((template) => (
                <button
                  type="button"
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={`text-left p-4 rounded-xl border transition-all min-h-[72px] ${
                    selectedTemplate?.id === template.id
                      ? 'border-rumi-accent bg-rumi-accent/5'
                      : 'border-rumi-border bg-rumi-sidebar/50 hover:border-rumi-accent/30 hover:bg-rumi-sidebar'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{template.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-sm font-semibold text-th-primary truncate">{template.name}</h3>
                        {template.isCommunity && (
                          <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
                            Community
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{template.description}</p>
                      {template.nodes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {template.nodes.slice(0, 5).map((node) => {
                            const def = BLOCK_TYPES[node.data?.blockType];
                            return (
                              <span
                                key={node.id}
                                className="text-[9px] px-1.5 py-0.5 rounded"
                                style={{
                                  backgroundColor: (def?.color || '#6b7280') + '15',
                                  color: def?.color || '#6b7280',
                                }}
                              >
                                {def?.icon} {node.data?.name}
                              </span>
                            );
                          })}
                          {template.nodes.length > 5 && (
                            <span className="text-[9px] text-gray-600">+{template.nodes.length - 5} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview panel */}
          {selectedTemplate && (
            <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-rumi-border bg-rumi-dark/30 p-4 overflow-y-auto shrink-0 max-h-[45vh] lg:max-h-none">
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="text-2xl">{selectedTemplate.icon}</span>
                <h3 className="text-sm font-semibold text-th-primary">{selectedTemplate.name}</h3>
                {selectedTemplate.isCommunity && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
                    Community
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-400 mb-4">{selectedTemplate.description}</p>

              {selectedTemplate.nodes.length > 0 && (
                <>
                  <h4 className="text-xs font-medium text-th-muted uppercase tracking-wider mb-2">
                    Blocks ({selectedTemplate.nodes.length})
                  </h4>
                  <div className="space-y-1.5 mb-4">
                    {selectedTemplate.nodes.map((node) => {
                      const def = BLOCK_TYPES[node.data?.blockType] || {};
                      return (
                        <div key={node.id} className="flex items-center gap-2 text-xs">
                          <span className="text-sm">{def.icon || '📦'}</span>
                          <span className="text-gray-300">{node.data?.name}</span>
                        </div>
                      );
                    })}
                  </div>

                  <h4 className="text-xs font-medium text-th-muted uppercase tracking-wider mb-2">
                    Connections ({selectedTemplate.edges.length})
                  </h4>
                  <div className="space-y-1 mb-6">
                    {selectedTemplate.edges.map((edge) => {
                      const src = selectedTemplate.nodes.find((n) => n.id === edge.source);
                      const tgt = selectedTemplate.nodes.find((n) => n.id === edge.target);
                      return (
                        <div key={edge.id} className="text-[10px] text-gray-500 flex items-center gap-1">
                          <span>{src?.data?.name || '?'}</span>
                          <span className="text-gray-600">&rarr;</span>
                          <span>{tgt?.data?.name || '?'}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <button
                onClick={() => handleUseTemplate(selectedTemplate)}
                disabled={creating}
                className="rumi-btn-primary w-full text-xs"
              >
                {creating ? 'Creating...' : 'Use This Template'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
