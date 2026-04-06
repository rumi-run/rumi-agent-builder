import React, { useState } from 'react';
import useCanvasStore from '../../stores/canvasStore';
import { BLOCK_TYPES, BLOCK_CATEGORIES } from '../../utils/blockTypes';

export default function ExportModal({ onClose }) {
  const { nodes, edges, buildName, buildDescription } = useCanvasStore();
  const [exporting, setExporting] = useState(false);

  // Check if Agent Intro block exists
  const agentIntroNode = nodes.find((n) => n.data?.blockType === 'agentIntro');
  const hasAgentIntro = agentIntroNode && (agentIntroNode.data?.agentTitle || agentIntroNode.data?.agentDescription);

  const generateHtml = () => {
    const introData = agentIntroNode?.data || {};
    const agentTitle = introData.agentTitle || buildName;
    const agentDescription = introData.agentDescription || '';
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    // Group blocks by category (exclude agentIntro from main blocks list)
    const blocksByCategory = {};
    nodes.forEach((node) => {
      if (node.data?.blockType === 'agentIntro') return;
      const def = BLOCK_TYPES[node.data?.blockType] || {};
      const cat = def.category || 'other';
      if (!blocksByCategory[cat]) blocksByCategory[cat] = [];
      blocksByCategory[cat].push({ node, def });
    });

    // Generate blocks HTML grouped by category
    const categorySections = Object.entries(blocksByCategory).map(([catKey, blocks]) => {
      const catDef = BLOCK_CATEGORIES[catKey] || { label: catKey };
      const blocksHtml = blocks.map(({ node, def }) => {
        const data = node.data || {};
        return `
          <div class="block" style="border-left: 4px solid ${def.color || '#6b7280'}">
            <div class="block-header">
              <span class="block-icon">${def.icon || '📦'}</span>
              <div class="block-header-text">
                <h3>${escapeHtml(data.name || def.label)}</h3>
                <span class="block-type">${escapeHtml(def.label)}</span>
              </div>
            </div>
            <div class="block-content">
              ${generateBlockContent(data)}
            </div>
          </div>
        `;
      }).join('\n');

      return `
        <div class="category-section">
          <h3 class="category-title">${escapeHtml(catDef.label)}</h3>
          ${blocksHtml}
        </div>
      `;
    }).join('\n');

    // File resources section
    const fileResourceNodes = nodes.filter((n) => n.data?.blockType === 'fileResources');
    let fileResourcesHtml = '';
    if (fileResourceNodes.length > 0) {
      const allResources = fileResourceNodes.flatMap((n) => n.data?.resources || []).filter((r) => r.url);
      if (allResources.length > 0) {
        fileResourcesHtml = `
          <div class="section">
            <h2>📎 File Resources</h2>
            <div class="resources-grid">
              ${allResources.map((r) => `
                <div class="resource-card">
                  <div class="resource-url">
                    ${renderSafeLink(r.url)}
                  </div>
                  ${r.description ? `<div class="resource-desc">${escapeHtml(r.description)}</div>` : ''}
                </div>
              `).join('\n')}
            </div>
          </div>
        `;
      }
    }

    const connectionsHtml = edges.map((edge) => {
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (!source || !target) return '';
      const connType = sanitizeConnectionType(edge.data?.connectionType);
      return `<li><span class="conn-type conn-${connType}">${connType}</span> <strong>${escapeHtml(source.data?.name || 'Block')}</strong> → <strong>${escapeHtml(target.data?.name || 'Block')}</strong></li>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(agentTitle)} - Agent Setup Guide | RUMI</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, system-ui, 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.7; font-size: 15px; }
    .container { max-width: 960px; margin: 0 auto; padding: 48px 32px; }

    /* Hero / Agent Intro */
    .hero { background: linear-gradient(135deg, #0a0e1a 0%, #1e293b 100%); border-radius: 16px; padding: 48px 40px; margin-bottom: 40px; color: white; position: relative; overflow: hidden; }
    .hero::before { content: ''; position: absolute; top: -50%; right: -20%; width: 400px; height: 400px; background: radial-gradient(circle, rgba(14,165,233,0.15) 0%, transparent 70%); pointer-events: none; }
    .hero-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; background: rgba(14,165,233,0.15); border: 1px solid rgba(14,165,233,0.3); border-radius: 20px; font-size: 11px; font-weight: 600; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px; }
    .hero h1 { font-size: 32px; font-weight: 800; line-height: 1.2; margin-bottom: 16px; letter-spacing: -0.5px; }
    .hero-description { font-size: 15px; line-height: 1.8; color: #cbd5e1; max-width: 720px; }
    .hero-meta { margin-top: 24px; display: flex; gap: 24px; flex-wrap: wrap; }
    .hero-meta-item { font-size: 12px; color: #64748b; display: flex; align-items: center; gap: 6px; }
    .hero-meta-item strong { color: #94a3b8; }

    /* Sections */
    .section { margin-bottom: 40px; }
    .section > h2 { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #e2e8f0; }

    /* Category sections */
    .category-section { margin-bottom: 24px; }
    .category-title { font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }

    /* Block cards */
    .block { background: white; border-radius: 12px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .block-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .block-icon { font-size: 24px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: #f8fafc; border-radius: 10px; }
    .block-header-text h3 { font-size: 17px; font-weight: 600; color: #0f172a; }
    .block-type { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500; }
    .block-content { font-size: 14px; color: #475569; }
    .block-content .field { margin-bottom: 12px; }
    .block-content .field-label { font-weight: 600; color: #334155; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 4px; }
    .block-content .field-value { margin-top: 2px; }

    /* Copyable content */
    .copyable { position: relative; }
    .copyable pre, .copyable .copy-text { background: #f1f5f9; padding: 16px; border-radius: 10px; font-size: 13px; overflow-x: auto; white-space: pre-wrap; line-height: 1.7; font-family: 'SF Mono', SFMono-Regular, Consolas, 'Liberation Mono', monospace; border: 1px solid #e2e8f0; }
    .copy-btn { position: absolute; top: 8px; right: 8px; padding: 4px 10px; background: white; border: 1px solid #d1d5db; border-radius: 6px; font-size: 11px; font-weight: 500; color: #475569; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 4px; }
    .copy-btn:hover { background: #f1f5f9; border-color: #94a3b8; }
    .copy-btn.copied { background: #10b981; border-color: #10b981; color: white; }

    .block-content ul { padding-left: 20px; }
    .block-content li { margin-bottom: 6px; line-height: 1.6; }

    /* Connections */
    .connections ul { list-style: none; padding: 0; }
    .connections li { padding: 12px 16px; background: white; border-radius: 10px; margin-bottom: 8px; font-size: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 8px; }
    .conn-type { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; padding: 2px 8px; border-radius: 4px; }
    .conn-data { background: #dbeafe; color: #1e40af; }
    .conn-control { background: #e2e8f0; color: #475569; }
    .conn-reference { background: #fef3c7; color: #92400e; }
    .conn-handoff { background: #e0e7ff; color: #4338ca; }

    /* Resources */
    .resources-grid { display: grid; gap: 12px; }
    .resource-card { background: white; border-radius: 10px; padding: 16px; border: 1px solid #e2e8f0; }
    .resource-url a { color: #0ea5e9; text-decoration: none; font-size: 13px; font-family: monospace; word-break: break-all; }
    .resource-url a:hover { text-decoration: underline; }
    .resource-desc { font-size: 13px; color: #64748b; margin-top: 6px; }

    /* Checklist */
    .checklist { background: white; border-radius: 12px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .checklist ul { list-style: none; padding: 0; }
    .checklist li { padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; display: flex; align-items: center; gap: 10px; }
    .checklist li:last-child { border: none; }
    .checklist li::before { content: ""; display: inline-block; width: 18px; height: 18px; border: 2px solid #cbd5e1; border-radius: 4px; flex-shrink: 0; }

    /* Footer */
    .footer { margin-top: 48px; padding-top: 20px; border-top: 2px solid #e2e8f0; color: #94a3b8; font-size: 12px; text-align: center; }
    .footer a { color: #0ea5e9; text-decoration: none; }

    @media print {
      body { background: white; font-size: 12px; }
      .container { padding: 20px; max-width: 100%; }
      .hero { background: #0f172a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .block { box-shadow: none; page-break-inside: avoid; }
      .copy-btn { display: none; }
    }
    @media (max-width: 640px) {
      .container { padding: 20px 16px; }
      .hero { padding: 32px 24px; }
      .hero h1 { font-size: 24px; }
      .hero-meta { flex-direction: column; gap: 8px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Agent Intro Hero -->
    <div class="hero">
      <div class="hero-badge">✨ RUMI Agent</div>
      <h1>${escapeHtml(agentTitle)}</h1>
      ${agentDescription ? `<div class="hero-description">${escapeHtml(agentDescription).replace(/\n/g, '<br>')}</div>` : ''}
      <div class="hero-meta">
        <div class="hero-meta-item">
          <strong>${nodes.filter((n) => n.data?.blockType !== 'agentIntro').length}</strong> blocks configured
        </div>
        <div class="hero-meta-item">
          <strong>${edges.length}</strong> connections
        </div>
        <div class="hero-meta-item">
          Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>
    </div>

    <!-- Agent Blocks -->
    <div class="section">
      <h2>🧩 Agent Configuration</h2>
      ${categorySections || '<p style="color: #94a3b8;">No blocks configured.</p>'}
    </div>

    ${fileResourcesHtml}

    ${edges.length > 0 ? `
    <div class="section connections">
      <h2>🔗 Connections</h2>
      <ul>${connectionsHtml}</ul>
    </div>
    ` : ''}

    <div class="section">
      <h2>✅ Setup Checklist</h2>
      <div class="checklist">
        <ul>
          ${generateChecklist(nodes)}
        </ul>
      </div>
    </div>

    <div class="footer">
      <p><strong>RUMI Agent Builder</strong> &middot; <a href="https://rumi.run/builder">rumi.run/builder</a></p>
      <p style="margin-top: 4px;">This document serves as the setup guide for implementing and configuring this agent.</p>
    </div>
  </div>

  <script>
    // Copy-to-clipboard functionality
    document.addEventListener('click', function(e) {
      const btn = e.target.closest('.copy-btn');
      if (!btn) return;
      const copyable = btn.closest('.copyable');
      const textEl = copyable.querySelector('pre') || copyable.querySelector('.copy-text');
      if (!textEl) return;
      const text = textEl.textContent;
      navigator.clipboard.writeText(text).then(function() {
        btn.classList.add('copied');
        btn.textContent = '✓ Copied';
        setTimeout(function() {
          btn.classList.remove('copied');
          btn.textContent = '📋 Copy';
        }, 2000);
      });
    });
  </script>
</body>
</html>`;
  };

  const handleExportHtml = () => {
    if (!hasAgentIntro) return;
    setExporting(true);
    try {
      const html = generateHtml();
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${buildName.replace(/[^a-zA-Z0-9]/g, '_')}_agent_guide.html`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleExportJson = () => {
    try {
      const data = {
        name: buildName,
        description: buildDescription,
        exportedAt: new Date().toISOString(),
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.data?.blockType,
          name: n.data?.name,
          position: n.position,
          data: n.data,
        })),
        edges: edges.map((e) => ({
          source: e.source,
          target: e.target,
          type: sanitizeConnectionType(e.data?.connectionType),
        })),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${buildName.replace(/[^a-zA-Z0-9]/g, '_')}_agent.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Export] JSON export failed:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-rumi-shell border border-rumi-border rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-th-primary">Export Agent</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-th-primary transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          {/* HTML Export — requires Agent Intro */}
          <div className="relative">
            {!hasAgentIntro && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-rumi-shell/90 backdrop-blur-sm border border-orange-500/20">
                <div className="text-center px-4">
                  <div className="text-2xl mb-2">✨</div>
                  <p className="text-xs font-medium text-orange-300">Agent Intro block required</p>
                  <p className="text-[11px] text-gray-500 mt-1">Add a Rumi → Agent Intro block and generate content before exporting to HTML</p>
                </div>
              </div>
            )}
            <button
              onClick={handleExportHtml}
              disabled={exporting || !hasAgentIntro}
              className={`w-full flex items-start gap-4 p-4 rounded-xl border border-rumi-border hover:border-rumi-accent/30 bg-rumi-sidebar/50 hover:bg-rumi-sidebar transition-all text-left ${!hasAgentIntro ? 'opacity-40 pointer-events-none' : ''}`}
            >
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-th-primary">Download as HTML</div>
                <div className="text-sm text-gray-500 mt-0.5">
                  Professional setup guide with agent intro, all block details, copy buttons, and checklist
                </div>
              </div>
            </button>
          </div>

          <button
            onClick={handleExportJson}
            className="w-full flex items-start gap-4 p-4 rounded-xl border border-rumi-border hover:border-rumi-accent/30 bg-rumi-sidebar/50 hover:bg-rumi-sidebar transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-th-primary">Download as JSON</div>
              <div className="text-sm text-gray-500 mt-0.5">
                Machine-readable agent specification for programmatic use
              </div>
            </div>
          </button>
        </div>

        <p className="text-xs text-gray-600 mt-4 text-center">
          {nodes.length} block(s) · {edges.length} connection(s)
        </p>
      </div>
    </div>
  );
}

function escapeHtml(str) {
  const normalized = String(str ?? '');
  return normalized.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sanitizeConnectionType(value) {
  const allowed = new Set(['data', 'control', 'reference', 'handoff']);
  const normalized = String(value || 'data').toLowerCase();
  return allowed.has(normalized) ? normalized : 'data';
}

function sanitizeHttpUrl(rawUrl) {
  const normalized = String(rawUrl || '').trim();
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
    return null;
  } catch {
    return null;
  }
}

function renderSafeLink(rawUrl) {
  const safeUrl = sanitizeHttpUrl(rawUrl);
  if (!safeUrl) {
    return `<span>${escapeHtml(rawUrl)}</span>`;
  }
  return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener">${escapeHtml(safeUrl)}</a>`;
}

function generateBlockContent(data) {
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
      if (data.description) fields.push({ label: 'Description', value: data.description, copyable: true });
      if (data.files?.length) fields.push({ label: 'Files', value: data.files.join(', ') });
      if (data.urls?.length) fields.push({ label: 'URLs', value: data.urls.join('\n'), pre: true, copyable: true });
      break;
    case 'instructions':
      if (data.persona) fields.push({ label: 'Persona', value: data.persona, copyable: true });
      if (data.instructions) fields.push({ label: 'System Instructions', value: data.instructions, pre: true, copyable: true });
      if (data.tone) fields.push({ label: 'Tone', value: data.tone });
      if (data.constraints?.length) fields.push({ label: 'Constraints', value: data.constraints, list: true, copyable: true });
      break;
    case 'tools':
      if (data.description) fields.push({ label: 'Description', value: data.description, copyable: true });
      if (data.toolList?.length) fields.push({ label: 'Tools', value: data.toolList, list: true, copyable: true });
      if (data.apiEndpoints?.length) fields.push({ label: 'API Endpoints', value: data.apiEndpoints.join('\n'), pre: true, copyable: true });
      break;
    case 'memory':
      if (data.memoryType) fields.push({ label: 'Memory Type', value: data.memoryType });
      if (data.windowSize) fields.push({ label: 'Context Window', value: `${data.windowSize} messages` });
      break;
    case 'guardrails':
      if (data.rules?.length) fields.push({ label: 'Safety Rules', value: data.rules, list: true, copyable: true });
      if (data.blockedTopics?.length) fields.push({ label: 'Blocked Topics', value: data.blockedTopics, list: true });
      if (data.outputFormat) fields.push({ label: 'Output Format', value: data.outputFormat });
      break;
    case 'input':
    case 'output':
      fields.push({ label: 'Type', value: data.inputType || data.outputType || 'chat' });
      fields.push({ label: 'Format', value: data.format || 'text' });
      if (data.description) fields.push({ label: 'Description', value: data.description, copyable: true });
      break;
    case 'condition':
      if (data.conditions?.length) fields.push({ label: 'Conditions', value: data.conditions, list: true, copyable: true });
      if (data.defaultRoute) fields.push({ label: 'Default Route', value: data.defaultRoute });
      break;
    case 'variable':
      if (data.variables?.length) fields.push({ label: 'Variables', value: data.variables.join('\n'), pre: true, copyable: true });
      break;
    case 'loop':
      fields.push({ label: 'Loop Type', value: data.loopType || 'forEach' });
      if (data.maxIterations) fields.push({ label: 'Max Iterations', value: String(data.maxIterations) });
      break;
    case 'subagent':
      if (data.linkedAgentName) fields.push({ label: 'Linked Agent', value: data.linkedAgentName });
      break;
    case 'connector':
      if (data.handoffRules) fields.push({ label: 'Handoff Rules', value: data.handoffRules, pre: true, copyable: true });
      if (data.dataPassthrough?.length) fields.push({ label: 'Data Passthrough', value: data.dataPassthrough, list: true });
      if (data.errorHandling) fields.push({ label: 'Error Handling', value: data.errorHandling, copyable: true });
      break;
    case 'fileResources':
      // Handled separately in the file resources section
      break;
    default:
      if (data.description) fields.push({ label: 'Description', value: data.description, copyable: true });
      break;
  }

  if (data.notes && data.blockType !== 'default') {
    fields.push({ label: 'Notes', value: data.notes, copyable: true });
  }

  return fields.map((f) => {
    let content;
    if (f.list) {
      const items = Array.isArray(f.value) ? f.value : [f.value];
      const listText = items.map((v) => `<li>${escapeHtml(v)}</li>`).join('');
      content = f.copyable
        ? `<div class="copyable"><button class="copy-btn">📋 Copy</button><div class="copy-text" style="background:transparent;border:none;padding:0;font-family:inherit;">\n<ul>${listText}</ul></div></div>`
        : `<ul>${listText}</ul>`;
    } else if (f.pre) {
      content = f.copyable
        ? `<div class="copyable"><button class="copy-btn">📋 Copy</button><pre>${escapeHtml(f.value)}</pre></div>`
        : `<pre>${escapeHtml(f.value)}</pre>`;
    } else if (f.copyable) {
      content = `<div class="copyable"><button class="copy-btn">📋 Copy</button><div class="copy-text">${escapeHtml(f.value)}</div></div>`;
    } else {
      content = escapeHtml(f.value);
    }

    return `
      <div class="field">
        <div class="field-label">${escapeHtml(f.label)}</div>
        <div class="field-value">${content}</div>
      </div>
    `;
  }).join('');
}

function generateChecklist(nodes) {
  const items = [];
  const hasType = (t) => nodes.some((n) => n.data?.blockType === t);

  if (hasType('llm')) {
    const llmNodes = nodes.filter((n) => n.data?.blockType === 'llm');
    llmNodes.forEach((n) => {
      items.push(`Set up ${n.data.provider || 'LLM'} ${n.data.model || 'model'} API access`);
    });
  }
  if (hasType('knowledge')) items.push('Prepare and index knowledge source documents');
  if (hasType('instructions')) items.push('Review and finalize system instructions');
  if (hasType('tools')) {
    items.push('Implement and test all tool integrations');
    const toolNodes = nodes.filter((n) => n.data?.blockType === 'tools');
    toolNodes.forEach((n) => {
      (n.data.apiEndpoints || []).forEach((ep) => {
        items.push(`Verify API endpoint: ${ep}`);
      });
    });
  }
  if (hasType('memory')) items.push('Configure memory/persistence storage');
  if (hasType('guardrails')) items.push('Test all guardrail rules and safety filters');
  if (hasType('input')) items.push('Configure and test input handler');
  if (hasType('output')) items.push('Configure and test output handler');
  if (hasType('subagent')) items.push('Build and test all sub-agents');
  if (hasType('connector')) items.push('Test agent-to-agent handoff protocols');
  if (hasType('fileResources')) items.push('Review and verify all file resource links');

  items.push('Run end-to-end testing');
  items.push('Deploy to staging environment');
  items.push('Monitor and iterate');

  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n');
}
