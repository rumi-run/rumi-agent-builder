import React, { useEffect, useState } from 'react';
import { agentApi } from '../../utils/api';
import useCanvasStore from '../../stores/canvasStore';

export default function ActivityPanel({ buildId, onClose }) {
  const [tab, setTab] = useState('activity'); // 'activity' | 'versions'
  const [activities, setActivities] = useState([]);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(null);

  useEffect(() => {
    loadData();
  }, [buildId, tab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === 'activity') {
        const data = await agentApi.getActivity(buildId);
        setActivities(data.activities || []);
      } else {
        const data = await agentApi.getVersions(buildId);
        setVersions(data.versions || []);
      }
    } catch (err) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (versionId) => {
    if (restoring) return;
    setRestoring(versionId);
    try {
      const data = await agentApi.restoreVersion(buildId, versionId);
      if (data.canvas_data) {
        useCanvasStore.getState().loadBuild({
          id: buildId,
          name: useCanvasStore.getState().buildName,
          description: useCanvasStore.getState().buildDescription,
          status: useCanvasStore.getState().buildStatus,
          canvas_data: data.canvas_data,
        });
      }
      loadData();
    } catch (err) {
      console.error('Failed to restore:', err);
    } finally {
      setRestoring(null);
    }
  };

  const formatTime = (d) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getActionLabel = (action) => {
    switch (action) {
      case 'update': return 'Updated';
      case 'create': return 'Created';
      case 'restore_version': return 'Restored version';
      case 'share': return 'Shared';
      default: return action;
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'update':
        return (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        );
      case 'restore_version':
        return (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      default:
        return (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getInitial = (email) => {
    return email?.[0]?.toUpperCase() || '?';
  };

  return (
    <div className="w-72 bg-rumi-shell border-l border-rumi-border flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-rumi-border">
        <h3 className="text-sm font-semibold text-th-primary">Activity & Versions</h3>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-rumi-border">
        {['activity', 'versions'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-rumi-accent text-rumi-accent'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t === 'activity' ? 'Activity Log' : 'Versions'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-rumi-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tab === 'activity' ? (
          <div className="py-2">
            {activities.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-8">No activity yet</p>
            ) : (
              activities.map((item) => (
                <div key={item.id} className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-white/[0.02]">
                  <div className="w-6 h-6 rounded-full bg-rumi-accent/15 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-rumi-accent text-[9px] font-bold">{getInitial(item.user_email)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400">{getActionIcon(item.action)}</span>
                      <span className="text-xs text-th-secondary font-medium">{getActionLabel(item.action)}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                      {item.user_email?.split('@')[0]}
                      {item.details?.fields && (
                        <span> · {item.details.fields.join(', ')}</span>
                      )}
                    </p>
                    <p className="text-[9px] text-gray-600 mt-0.5">{formatTime(item.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="py-2">
            {versions.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-8">No versions saved yet</p>
            ) : (
              versions.map((ver) => (
                <div key={ver.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02]">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-th-secondary font-medium">v{ver.version_num}</span>
                      <span className="text-[9px] text-gray-600">{formatTime(ver.created_at)}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                      {ver.user_email?.split('@')[0] || 'Unknown'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestore(ver.id)}
                    disabled={restoring === ver.id}
                    className="text-[10px] text-gray-500 hover:text-rumi-accent transition-colors shrink-0"
                  >
                    {restoring === ver.id ? '...' : 'Restore'}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
