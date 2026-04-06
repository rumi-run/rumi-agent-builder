import React, { useState, useEffect } from 'react';
import { BLOCK_TYPES } from '../../utils/blockTypes';
import useCanvasStore from '../../stores/canvasStore';
import AiWriter from './AiWriter';
import { aiApi } from '../../utils/api';

export default function DetailPanel({ onOpenComments, onClose, blockLocks, currentUserId }) {
  const { detailPanelOpen, detailPanelNode, closeDetailPanel, updateNodeData, removeNode } = useCanvasStore();
  const [localData, setLocalData] = useState({});
  const [knowledgeListDraft, setKnowledgeListDraft] = useState('');
  const [lineDrafts, setLineDrafts] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (detailPanelNode) {
      setLocalData({ ...detailPanelNode.data });
      const nodeSourceType = detailPanelNode.data.sourceType || 'files';
      const nodeItems = nodeSourceType === 'urls'
        ? (detailPanelNode.data.urls || [])
        : (detailPanelNode.data.files || []);
      setKnowledgeListDraft(Array.isArray(nodeItems) ? nodeItems.join('\n') : '');
      setLineDrafts({
        constraints: (detailPanelNode.data.constraints || []).join('\n'),
        toolList: (detailPanelNode.data.toolList || []).join('\n'),
        apiEndpoints: (detailPanelNode.data.apiEndpoints || []).join('\n'),
        rules: (detailPanelNode.data.rules || []).join('\n'),
        blockedTopics: (detailPanelNode.data.blockedTopics || []).join('\n'),
        variables: (detailPanelNode.data.variables || []).join('\n'),
        conditions: (detailPanelNode.data.conditions || []).join('\n'),
        dataPassthrough: (detailPanelNode.data.dataPassthrough || []).join('\n'),
      });
      setDeleteConfirm(false);
    }
  }, [detailPanelNode]);

  if (!detailPanelOpen || !detailPanelNode) return null;

  const blockDef = BLOCK_TYPES[localData.blockType] || {};

  // Check if block is locked by another user
  const lock = blockLocks?.[detailPanelNode.id];
  const isLockedByOther = lock && lock.userId !== currentUserId;

  const handleChange = (key, value) => {
    if (isLockedByOther) return;
    const updated = { ...localData, [key]: value };
    setLocalData(updated);
    updateNodeData(detailPanelNode.id, { [key]: value });
  };

  const handleDelete = () => {
    if (isLockedByOther) return;
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    removeNode(detailPanelNode.id);
    closeDetailPanel();
  };

  return (
    <div className="w-80 bg-rumi-shell border-l border-rumi-border flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-rumi-border">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm"
            style={{ backgroundColor: (blockDef.color || '#6b7280') + '15' }}
          >
            {blockDef.icon || '📦'}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-th-primary truncate">
              {blockDef.label}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onOpenComments && (
            <button
              onClick={() => onOpenComments(detailPanelNode.id)}
              className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:text-rumi-accent hover:bg-white/5 transition-colors"
              title="Comments"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </button>
          )}
        <button
          onClick={onClose || closeDetailPanel}
          className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Lock warning */}
        {isLockedByOther && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <svg className="w-4 h-4 text-orange-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-[11px] text-orange-300">
              Being edited by <strong>{lock?.userName?.split('@')[0]}</strong>
            </span>
          </div>
        )}
        <fieldset disabled={isLockedByOther} className="space-y-4">
          {/* Name - universal */}
          <div>
            <label className="rumi-label">Block Name</label>
            <input
              type="text"
              className="rumi-input"
              value={localData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder={blockDef.label}
            />
          </div>

          {/* Type-specific fields */}
          {renderTypeFields(localData, handleChange, {
            knowledgeListDraft,
            setKnowledgeListDraft,
            lineDrafts,
            setLineDrafts,
          })}

          {/* Notes - universal */}
          <div>
            <label className="rumi-label">Notes</label>
            <textarea
              className="rumi-textarea h-24"
              value={localData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Additional notes or context..."
            />
          </div>
        </fieldset>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-rumi-border">
        <button
          onClick={handleDelete}
          disabled={isLockedByOther}
          className={`rumi-btn-danger w-full text-xs ${deleteConfirm ? '!bg-red-500/30' : ''}`}
        >
          {deleteConfirm ? 'Click again to confirm delete' : 'Delete Block'}
        </button>
      </div>
    </div>
  );
}

function renderTypeFields(data, onChange, uiState = {}) {
  const { knowledgeListDraft = '', setKnowledgeListDraft = () => {} } = uiState;
  const { lineDrafts = {}, setLineDrafts = () => {} } = uiState;
  const setListDraft = (key, value) => setLineDrafts((prev) => ({ ...prev, [key]: value }));
  const toItems = (rawValue) =>
    rawValue
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  switch (data.blockType) {
    case 'llm':
      return (
        <>
          <div>
            <label className="rumi-label">Provider</label>
            <select
              className="rumi-input"
              value={data.provider || ''}
              onChange={(e) => onChange('provider', e.target.value)}
            >
              <option value="">Select provider</option>
              <option value="Anthropic">Anthropic (Claude)</option>
              <option value="OpenAI">OpenAI (GPT)</option>
              <option value="Google">Google (Gemini)</option>
              <option value="Meta">Meta (Llama)</option>
              <option value="Mistral">Mistral</option>
              <option value="Cohere">Cohere</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="rumi-label">Model Name</label>
            <input
              type="text"
              className="rumi-input"
              value={data.model || ''}
              onChange={(e) => onChange('model', e.target.value)}
              placeholder="e.g. claude-opus-4-6"
            />
          </div>
          <div>
            <label className="rumi-label">Temperature ({data.temperature ?? 0.7})</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              className="w-full accent-rumi-accent"
              value={data.temperature ?? 0.7}
              onChange={(e) => onChange('temperature', parseFloat(e.target.value))}
            />
            <div className="flex justify-between text-[10px] text-gray-600">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>
          <div>
            <label className="rumi-label">Max Tokens</label>
            <input
              type="number"
              className="rumi-input"
              value={data.maxTokens || 4096}
              onChange={(e) => onChange('maxTokens', parseInt(e.target.value) || 4096)}
              min={1}
            />
          </div>
        </>
      );

    case 'knowledge':
      return (
        <>
          <div>
            <label className="rumi-label">Source Type</label>
            <select
              className="rumi-input"
              value={data.sourceType || 'files'}
              onChange={(e) => {
                const nextSourceType = e.target.value;
                onChange('sourceType', nextSourceType);
                const nextItems = nextSourceType === 'urls' ? (data.urls || []) : (data.files || []);
                setKnowledgeListDraft(Array.isArray(nextItems) ? nextItems.join('\n') : '');
              }}
            >
              <option value="files">Files (PDF, CSV, TXT, etc.)</option>
              <option value="urls">URLs / Web Pages</option>
              <option value="database">Database Connection</option>
              <option value="api">API Endpoint</option>
            </select>
          </div>
          <div>
            <label className="rumi-label">Description</label>
            <textarea
              className="rumi-textarea h-20"
              value={data.description || ''}
              onChange={(e) => onChange('description', e.target.value)}
              placeholder="Describe the knowledge sources this agent will use..."
            />
          </div>
          <div>
            <label className="rumi-label">
              {data.sourceType === 'urls' ? 'URLs (one per line)' : 'File Names (one per line)'}
            </label>
            <textarea
              className="rumi-textarea h-24 font-mono text-xs"
              value={knowledgeListDraft}
              onChange={(e) => {
                const rawValue = e.target.value;
                setKnowledgeListDraft(rawValue);
                const items = rawValue
                  .split('\n')
                  .map((item) => item.trim())
                  .filter(Boolean);
                if (data.sourceType === 'urls') {
                  onChange('urls', items);
                } else {
                  onChange('files', items);
                }
              }}
              placeholder={
                data.sourceType === 'urls'
                  ? 'https://docs.example.com\nhttps://wiki.internal.com'
                  : 'product-catalog.pdf\nfaq-database.csv\npolicies.md'
              }
            />
          </div>
        </>
      );

    case 'instructions':
      return (
        <>
          <div>
            <label className="rumi-label">Persona / Role</label>
            <input
              type="text"
              className="rumi-input"
              value={data.persona || ''}
              onChange={(e) => onChange('persona', e.target.value)}
              placeholder="e.g. Senior customer support specialist"
            />
          </div>
          <div>
            <label className="rumi-label">System Instructions</label>
            <textarea
              className="rumi-textarea h-40"
              value={data.instructions || ''}
              onChange={(e) => onChange('instructions', e.target.value)}
              placeholder="Write the core instructions for this agent's behavior, goals, and constraints..."
            />
          </div>
          {/* AI Writer */}
          <AiWriter
            currentInstructions={data.instructions || ''}
            onApply={(text) => onChange('instructions', text)}
          />
          <div>
            <label className="rumi-label">Tone</label>
            <select
              className="rumi-input"
              value={data.tone || ''}
              onChange={(e) => onChange('tone', e.target.value)}
            >
              <option value="">Select tone</option>
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="casual">Casual</option>
              <option value="formal">Formal</option>
              <option value="technical">Technical</option>
              <option value="empathetic">Empathetic</option>
            </select>
          </div>
          <div>
            <label className="rumi-label">Constraints (one per line)</label>
            <textarea
              className="rumi-textarea h-20 font-mono text-xs"
              value={lineDrafts.constraints ?? (data.constraints || []).join('\n')}
              onChange={(e) => {
                setListDraft('constraints', e.target.value);
                onChange('constraints', toItems(e.target.value));
              }}
              placeholder="Never share internal pricing\nAlways respond in English\nLimit responses to 200 words"
            />
          </div>
        </>
      );

    case 'tools':
      return (
        <>
          <div>
            <label className="rumi-label">Description</label>
            <textarea
              className="rumi-textarea h-20"
              value={data.description || ''}
              onChange={(e) => onChange('description', e.target.value)}
              placeholder="What tools/capabilities does this agent have?"
            />
          </div>
          <div>
            <label className="rumi-label">Tool Names (one per line)</label>
            <textarea
              className="rumi-textarea h-24 font-mono text-xs"
              value={lineDrafts.toolList ?? (data.toolList || []).join('\n')}
              onChange={(e) => {
                setListDraft('toolList', e.target.value);
                onChange('toolList', toItems(e.target.value));
              }}
              placeholder="web_search\nsend_email\ncreate_ticket\nquery_database"
            />
          </div>
          <div>
            <label className="rumi-label">API Endpoints (one per line)</label>
            <textarea
              className="rumi-textarea h-20 font-mono text-xs"
              value={lineDrafts.apiEndpoints ?? (data.apiEndpoints || []).join('\n')}
              onChange={(e) => {
                setListDraft('apiEndpoints', e.target.value);
                onChange('apiEndpoints', toItems(e.target.value));
              }}
              placeholder="POST /api/search\nGET /api/users/:id"
            />
          </div>
        </>
      );

    case 'memory':
      return (
        <>
          <div>
            <label className="rumi-label">Memory Type</label>
            <select
              className="rumi-input"
              value={data.memoryType || 'conversation'}
              onChange={(e) => onChange('memoryType', e.target.value)}
            >
              <option value="conversation">Conversation History</option>
              <option value="summary">Summary Memory</option>
              <option value="vector">Vector Store (Long-term)</option>
              <option value="key-value">Key-Value Store</option>
            </select>
          </div>
          <div>
            <label className="rumi-label">Context Window Size</label>
            <input
              type="number"
              className="rumi-input"
              value={data.windowSize || 10}
              onChange={(e) => onChange('windowSize', parseInt(e.target.value) || 10)}
              min={1}
            />
          </div>
        </>
      );

    case 'guardrails':
      return (
        <>
          <div>
            <label className="rumi-label">Safety Rules (one per line)</label>
            <textarea
              className="rumi-textarea h-28 font-mono text-xs"
              value={lineDrafts.rules ?? (data.rules || []).join('\n')}
              onChange={(e) => {
                setListDraft('rules', e.target.value);
                onChange('rules', toItems(e.target.value));
              }}
              placeholder="No personal data collection\nBlock harmful content\nVerify before financial actions"
            />
          </div>
          <div>
            <label className="rumi-label">Blocked Topics (one per line)</label>
            <textarea
              className="rumi-textarea h-20 font-mono text-xs"
              value={lineDrafts.blockedTopics ?? (data.blockedTopics || []).join('\n')}
              onChange={(e) => {
                setListDraft('blockedTopics', e.target.value);
                onChange('blockedTopics', toItems(e.target.value));
              }}
              placeholder="Competitor comparisons\nLegal advice\nMedical diagnoses"
            />
          </div>
          <div>
            <label className="rumi-label">Output Format Validation</label>
            <input
              type="text"
              className="rumi-input"
              value={data.outputFormat || ''}
              onChange={(e) => onChange('outputFormat', e.target.value)}
              placeholder="e.g. JSON, Markdown, Plain text"
            />
          </div>
        </>
      );

    case 'input':
    case 'output':
      return (
        <>
          <div>
            <label className="rumi-label">{data.blockType === 'input' ? 'Input' : 'Output'} Type</label>
            <select
              className="rumi-input"
              value={data[`${data.blockType}Type`] || 'chat'}
              onChange={(e) => onChange(`${data.blockType}Type`, e.target.value)}
            >
              <option value="chat">Chat Interface</option>
              <option value="api">REST API</option>
              <option value="webhook">Webhook</option>
              <option value="email">Email</option>
              <option value="scheduled">Scheduled Trigger</option>
              <option value="file">File Upload/Download</option>
            </select>
          </div>
          <div>
            <label className="rumi-label">Format</label>
            <select
              className="rumi-input"
              value={data.format || 'text'}
              onChange={(e) => onChange('format', e.target.value)}
            >
              <option value="text">Plain Text</option>
              <option value="json">JSON</option>
              <option value="markdown">Markdown</option>
              <option value="html">HTML</option>
            </select>
          </div>
          <div>
            <label className="rumi-label">Description</label>
            <textarea
              className="rumi-textarea h-20"
              value={data.description || ''}
              onChange={(e) => onChange('description', e.target.value)}
              placeholder={`Describe how ${data.blockType === 'input' ? 'input is received' : 'output is delivered'}...`}
            />
          </div>
        </>
      );

    case 'variable':
      return (
        <div>
          <label className="rumi-label">Variables (name=value, one per line)</label>
          <textarea
            className="rumi-textarea h-32 font-mono text-xs"
            value={lineDrafts.variables ?? (data.variables || []).join('\n')}
            onChange={(e) => {
              setListDraft('variables', e.target.value);
              onChange('variables', toItems(e.target.value));
            }}
            placeholder="user_name={{user.name}}\npreferred_language=en\nmax_retries=3"
          />
        </div>
      );

    case 'condition':
      return (
        <>
          <div>
            <label className="rumi-label">Conditions (one per line)</label>
            <textarea
              className="rumi-textarea h-28 font-mono text-xs"
              value={lineDrafts.conditions ?? (data.conditions || []).join('\n')}
              onChange={(e) => {
                setListDraft('conditions', e.target.value);
                onChange('conditions', toItems(e.target.value));
              }}
              placeholder="IF intent == 'billing' → Billing Agent\nIF intent == 'technical' → Tech Agent\nDEFAULT → General Agent"
            />
          </div>
          <div>
            <label className="rumi-label">Default Route</label>
            <input
              type="text"
              className="rumi-input"
              value={data.defaultRoute || ''}
              onChange={(e) => onChange('defaultRoute', e.target.value)}
              placeholder="What happens if no condition matches?"
            />
          </div>
        </>
      );

    case 'loop':
      return (
        <>
          <div>
            <label className="rumi-label">Loop Type</label>
            <select
              className="rumi-input"
              value={data.loopType || 'forEach'}
              onChange={(e) => onChange('loopType', e.target.value)}
            >
              <option value="forEach">For Each Item</option>
              <option value="while">While Condition</option>
              <option value="retry">Retry on Failure</option>
              <option value="batch">Batch Processing</option>
            </select>
          </div>
          <div>
            <label className="rumi-label">Max Iterations</label>
            <input
              type="number"
              className="rumi-input"
              value={data.maxIterations || 10}
              onChange={(e) => onChange('maxIterations', parseInt(e.target.value) || 10)}
              min={1}
            />
          </div>
        </>
      );

    case 'subagent':
      return (
        <div>
          <label className="rumi-label">Linked Agent Name</label>
          <input
            type="text"
            className="rumi-input"
            value={data.linkedAgentName || ''}
            onChange={(e) => onChange('linkedAgentName', e.target.value)}
            placeholder="Name of the agent to connect to"
          />
        </div>
      );

    case 'connector':
      return (
        <>
          <div>
            <label className="rumi-label">Handoff Rules</label>
            <textarea
              className="rumi-textarea h-28"
              value={data.handoffRules || ''}
              onChange={(e) => onChange('handoffRules', e.target.value)}
              placeholder="Describe when and how to hand off between agents..."
            />
          </div>
          <div>
            <label className="rumi-label">Data Passthrough (one per line)</label>
            <textarea
              className="rumi-textarea h-20 font-mono text-xs"
              value={lineDrafts.dataPassthrough ?? (data.dataPassthrough || []).join('\n')}
              onChange={(e) => {
                setListDraft('dataPassthrough', e.target.value);
                onChange('dataPassthrough', toItems(e.target.value));
              }}
              placeholder="user_context\nconversation_history\nresolved_intent"
            />
          </div>
          <div>
            <label className="rumi-label">Error Handling</label>
            <textarea
              className="rumi-textarea h-16"
              value={data.errorHandling || ''}
              onChange={(e) => onChange('errorHandling', e.target.value)}
              placeholder="What happens if the handoff fails?"
            />
          </div>
        </>
      );

    case 'agentIntro':
      return <AgentIntroFields data={data} onChange={onChange} />;

    case 'fileResources':
      return <FileResourcesFields data={data} onChange={onChange} />;

    default:
      return null;
  }
}

function AgentIntroFields({ data, onChange }) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const { nodes } = useCanvasStore();

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      // Collect all blocks data for context
      const blocksContext = nodes
        .filter((n) => n.data?.blockType !== 'agentIntro')
        .map((n) => {
          const def = BLOCK_TYPES[n.data?.blockType] || {};
          return {
            type: def.label || n.data?.blockType,
            name: n.data?.name,
            ...n.data,
          };
        });

      const userInstructions = data.userInstructions || '';
      const res = await aiApi.generateAgentIntro({
        blocks: blocksContext,
        userInstructions,
      });
      const title = (res?.title || '').trim();
      const description = (res?.description || '').trim();
      if (title) onChange('agentTitle', title);
      if (description) onChange('agentDescription', description);
      if (!title && !description) {
        setError('AI returned empty content. Please retry.');
      }
    } catch (err) {
      setError(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const wordCount = (data.agentDescription || '').trim().split(/\s+/).filter(Boolean).length;

  return (
    <>
      <div>
        <label className="rumi-label">Agent Title</label>
        <input
          type="text"
          className="rumi-input"
          value={data.agentTitle || ''}
          onChange={(e) => onChange('agentTitle', e.target.value)}
          placeholder="AI-generated or custom agent title"
        />
      </div>
      <div>
        <label className="rumi-label">Agent Description ({wordCount}/314 words)</label>
        <textarea
          className="rumi-textarea h-40"
          value={data.agentDescription || ''}
          onChange={(e) => onChange('agentDescription', e.target.value)}
          placeholder="A brief description of this agent's purpose and capabilities..."
        />
      </div>
      <div>
        <label className="rumi-label">Instructions for AI (optional)</label>
        <textarea
          className="rumi-textarea h-16"
          value={data.userInstructions || ''}
          onChange={(e) => onChange('userInstructions', e.target.value)}
          placeholder="e.g. Focus on customer service aspects, keep it formal..."
        />
      </div>
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="w-full py-2 px-3 rounded-lg text-xs font-medium bg-rumi-accent/15 text-rumi-accent hover:bg-rumi-accent/25 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {generating ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-rumi-accent/30 border-t-rumi-accent rounded-full animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <span>✨</span>
            {data.agentTitle ? 'Regenerate with AI' : 'Generate with AI'}
          </>
        )}
      </button>
      {error && (
        <p className="text-xs text-red-400 mt-1">{error}</p>
      )}
    </>
  );
}

function FileResourcesFields({ data, onChange }) {
  const resources = data.resources || [];

  const addResource = () => {
    onChange('resources', [...resources, { url: '', description: '' }]);
  };

  const updateResource = (index, field, value) => {
    const updated = resources.map((r, i) =>
      i === index ? { ...r, [field]: value } : r
    );
    onChange('resources', updated);
  };

  const removeResource = (index) => {
    onChange('resources', resources.filter((_, i) => i !== index));
  };

  return (
    <>
      <div className="space-y-3">
        {resources.map((resource, index) => (
          <div key={index} className="p-3 rounded-lg border border-rumi-border bg-rumi-sidebar/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Resource #{index + 1}</span>
              <button
                onClick={() => removeResource(index)}
                className="text-gray-500 hover:text-red-400 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <input
              type="url"
              className="rumi-input text-xs"
              value={resource.url || ''}
              onChange={(e) => updateResource(index, 'url', e.target.value)}
              placeholder="https://drive.google.com/..."
            />
            <input
              type="text"
              className="rumi-input text-xs"
              value={resource.description || ''}
              onChange={(e) => updateResource(index, 'description', e.target.value)}
              placeholder="Description of this file..."
            />
          </div>
        ))}
      </div>
      <button
        onClick={addResource}
        className="w-full py-2 px-3 rounded-lg text-xs font-medium border border-dashed border-rumi-border text-gray-400 hover:text-rumi-accent hover:border-rumi-accent/30 transition-colors flex items-center justify-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Resource
      </button>
    </>
  );
}
