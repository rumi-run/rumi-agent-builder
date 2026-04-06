import React, { useState } from 'react';
import { aiApi } from '../../utils/api';

export default function AiWriter({ currentInstructions, onApply }) {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('generate'); // 'generate' | 'improve'

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    setResult('');

    try {
      const fullPrompt = mode === 'improve' && currentInstructions
        ? `Improve the following agent instructions based on this feedback: "${prompt.trim()}"\n\nCurrent instructions:\n${currentInstructions}`
        : prompt.trim();

      const data = await aiApi.generateInstructions(fullPrompt);
      setResult(data.instructions || '');
    } catch (err) {
      setError(err.message === 'AI service not configured'
        ? 'AI service not configured. Ask your admin to set up the AI API in Admin > AI Configuration.'
        : err.message || 'Failed to generate instructions');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (result) {
      onApply(result);
      setResult('');
      setPrompt('');
    }
  };

  return (
    <div className="border border-rumi-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-rumi-dark/50 border-b border-rumi-border">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-rumi-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <span className="text-[10px] font-medium text-rumi-purple">AI Assistant</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setMode('generate')}
            className={`text-[9px] px-2 py-0.5 rounded transition-colors ${
              mode === 'generate' ? 'bg-rumi-purple/10 text-rumi-purple' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Generate
          </button>
          {currentInstructions && (
            <button
              onClick={() => setMode('improve')}
              className={`text-[9px] px-2 py-0.5 rounded transition-colors ${
                mode === 'improve' ? 'bg-rumi-purple/10 text-rumi-purple' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Improve
            </button>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="p-3">
        <textarea
          className="rumi-textarea h-16 text-xs"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={mode === 'generate'
            ? 'Describe what this agent should do...\ne.g. "A customer support agent for a SaaS product that handles billing questions and technical issues"'
            : 'What should be improved?\ne.g. "Make it more concise and add error handling instructions"'
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleGenerate();
            }
          }}
        />

        <div className="flex items-center justify-between mt-2">
          <span className="text-[9px] text-gray-600">
            {mode === 'generate' ? 'Ctrl+Enter to generate' : 'Ctrl+Enter to improve'}
          </span>
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="text-[10px] px-3 py-1 rounded-md bg-rumi-purple/10 text-rumi-purple hover:bg-rumi-purple/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            {loading ? (
              <>
                <div className="w-2.5 h-2.5 border border-rumi-purple/50 border-t-rumi-purple rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                {mode === 'generate' ? 'Generate' : 'Improve'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 pb-3">
          <div className="text-[10px] text-red-400 bg-red-500/5 rounded-md px-3 py-2 border border-red-500/10">
            {error}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="border-t border-rumi-border">
          <div className="px-3 py-2 bg-rumi-dark/30">
            <div className="text-[9px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">Generated Instructions</div>
            <div className="text-xs text-gray-300 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed bg-rumi-dark/50 rounded-md p-2.5 border border-rumi-border">
              {result}
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleApply}
                className="text-[10px] px-3 py-1 rounded-md bg-rumi-accent/10 text-rumi-accent hover:bg-rumi-accent/20 transition-colors"
              >
                Apply to Instructions
              </button>
              <button
                onClick={() => { setResult(''); setPrompt(''); }}
                className="text-[10px] px-3 py-1 rounded-md text-gray-500 hover:text-gray-300 transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
