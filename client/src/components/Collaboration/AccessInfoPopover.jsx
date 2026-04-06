import React, { useEffect, useState } from 'react';
import { agentApi, sharingApi } from '../../utils/api';
import useAuthStore from '../../stores/authStore';

export default function AccessInfoPopover({ buildId, onClose }) {
  const { user } = useAuthStore();
  const [accessInfo, setAccessInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccess();
    const handleClick = (e) => {
      if (!e.target.closest('.access-popover')) onClose();
    };
    setTimeout(() => document.addEventListener('click', handleClick), 10);
    return () => document.removeEventListener('click', handleClick);
  }, [buildId]);

  const loadAccess = async () => {
    try {
      const data = await agentApi.getAccess(buildId);
      setAccessInfo(data);
    } catch (err) {
      console.error('Failed to load access info:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (shareId) => {
    try {
      await sharingApi.revokeShare(shareId);
      loadAccess(); // reload
    } catch (err) {
      console.error('Failed to revoke:', err);
    }
  };

  const getInitial = (str) => str?.[0]?.toUpperCase() || '?';

  return (
    <div
      className="access-popover absolute z-50 left-0 right-0 mt-1 bg-rumi-shell border border-rumi-border rounded-lg shadow-xl p-3"
      onClick={(e) => e.stopPropagation()}
    >
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="w-4 h-4 border-2 border-rumi-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !accessInfo ? (
        <p className="text-gray-500 text-xs text-center py-2">Failed to load</p>
      ) : (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-th-muted uppercase tracking-wider">Access</h4>

          {/* Owner */}
          <div className="flex items-center gap-2 py-1.5">
            <div className="w-6 h-6 rounded-full bg-yellow-500/15 flex items-center justify-center">
              <span className="text-yellow-400 text-[9px] font-bold">{getInitial(accessInfo.owner.email)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs text-th-primary truncate block">
                {accessInfo.owner.name || accessInfo.owner.email?.split('@')[0]}
              </span>
            </div>
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400">owner</span>
          </div>

          {/* Shared users */}
          {accessInfo.shares.map((share) => (
            <div key={share.id} className="flex items-center gap-2 py-1.5">
              <div className="w-6 h-6 rounded-full bg-blue-500/15 flex items-center justify-center">
                <span className="text-blue-400 text-[9px] font-bold">
                  {getInitial(share.shared_with_email)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-th-primary truncate block">
                  {share.shared_with_email || 'Public link'}
                </span>
              </div>
              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                share.permission === 'edit' ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-500/10 text-gray-400'
              }`}>
                {share.permission}
              </span>
              {/* Owner can revoke */}
              {accessInfo.myAccess === 'owner' && (
                <button
                  onClick={() => handleRevoke(share.id)}
                  className="text-[9px] text-gray-600 hover:text-red-400 transition-colors"
                  title="Revoke access"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}

          {/* Org members */}
          {accessInfo.orgMembers.length > 0 && (
            <>
              <div className="border-t border-rumi-border mt-2 pt-2">
                <h4 className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Team Members</h4>
              </div>
              {accessInfo.orgMembers.slice(0, 5).map((m) => (
                <div key={m.user_id} className="flex items-center gap-2 py-1">
                  <div className="w-5 h-5 rounded-full bg-green-500/15 flex items-center justify-center">
                    <span className="text-green-400 text-[8px] font-bold">{getInitial(m.email)}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 truncate flex-1">
                    {m.name || m.email?.split('@')[0]}
                  </span>
                  <span className="text-[8px] text-gray-600">{m.role}</span>
                </div>
              ))}
              {accessInfo.orgMembers.length > 5 && (
                <p className="text-[9px] text-gray-600">+{accessInfo.orgMembers.length - 5} more</p>
              )}
            </>
          )}

          {accessInfo.shares.length === 0 && accessInfo.orgMembers.length === 0 && (
            <p className="text-[10px] text-gray-600 py-1">Only the owner has access</p>
          )}
        </div>
      )}
    </div>
  );
}
