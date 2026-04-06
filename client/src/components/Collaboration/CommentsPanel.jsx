import React, { useState, useEffect, useRef } from 'react';
import { commentApi } from '../../utils/api';
import useAuthStore from '../../stores/authStore';

export default function CommentsPanel({ buildId, nodeId, onClose, onCommentAdded }) {
  const { user } = useAuthStore();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const scrollRef = useRef();

  useEffect(() => {
    loadComments();
  }, [buildId]);

  const loadComments = async () => {
    try {
      const data = await commentApi.list(buildId);
      setComments(data.comments || []);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() || !nodeId) return;

    setSubmitting(true);
    try {
      const data = await commentApi.create(buildId, {
        nodeId,
        content: content.trim(),
        parentId: replyTo || undefined,
      });
      setComments((prev) => [...prev, data.comment]);
      setContent('');
      setReplyTo(null);
      onCommentAdded?.(data.comment);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (commentId, resolved) => {
    try {
      await commentApi.resolve(commentId, resolved);
      setComments((prev) =>
        prev.map((c) => c.id === commentId ? { ...c, resolved: resolved ? 1 : 0 } : c)
      );
    } catch (err) {
      console.error('Failed to resolve:', err);
    }
  };

  const handleDelete = async (commentId) => {
    try {
      await commentApi.delete(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId && c.parent_id !== commentId));
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  // Filter to current node if nodeId is set
  const filtered = nodeId
    ? comments.filter((c) => c.node_id === nodeId)
    : comments;

  const topLevel = filtered.filter((c) => !c.parent_id);
  const replies = (parentId) => filtered.filter((c) => c.parent_id === parentId);

  const formatTime = (d) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-72 bg-rumi-shell border-l border-rumi-border flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-rumi-border shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          <span className="text-sm font-semibold text-th-primary">
            Comments {nodeId && <span className="text-gray-500">({filtered.length})</span>}
          </span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3" ref={scrollRef}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-4 h-4 border-2 border-rumi-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : topLevel.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600 text-xs">No comments yet</p>
            <p className="text-gray-700 text-[10px] mt-1">Add the first comment below</p>
          </div>
        ) : (
          topLevel.map((comment) => (
            <div key={comment.id} className={`${comment.resolved ? 'opacity-50' : ''}`}>
              <CommentItem
                comment={comment}
                isOwner={comment.user_id === user?.id}
                onResolve={handleResolve}
                onDelete={handleDelete}
                onReply={() => setReplyTo(comment.id)}
                formatTime={formatTime}
              />
              {/* Replies */}
              {replies(comment.id).map((reply) => (
                <div key={reply.id} className="ml-4 mt-1.5 pl-2 border-l border-rumi-border">
                  <CommentItem
                    comment={reply}
                    isOwner={reply.user_id === user?.id}
                    onDelete={handleDelete}
                    formatTime={formatTime}
                    isReply
                  />
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Input */}
      {nodeId && (
        <form onSubmit={handleSubmit} className="px-3 py-2 border-t border-rumi-border shrink-0">
          {replyTo && (
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-500">Replying to comment</span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="text-[10px] text-gray-600 hover:text-gray-400"
              >
                Cancel
              </button>
            </div>
          )}
          <div className="flex items-end gap-1.5">
            <textarea
              className="rumi-input text-xs flex-1 resize-none"
              rows={2}
              placeholder="Add a comment..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <button
              type="submit"
              disabled={!content.trim() || submitting}
              className="rumi-btn-primary text-xs h-8 px-2.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function CommentItem({ comment, isOwner, onResolve, onDelete, onReply, formatTime, isReply }) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className="group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start gap-2">
        <div className="w-5 h-5 rounded-full bg-rumi-accent/20 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-rumi-accent text-[8px] font-bold">
            {(comment.user_name || comment.user_email)?.[0]?.toUpperCase() || '?'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-gray-300">
              {comment.user_name || comment.user_email?.split('@')[0]}
            </span>
            <span className="text-[9px] text-gray-600">{formatTime(comment.created_at)}</span>
            {comment.resolved ? (
              <span className="text-[9px] text-green-500/60 font-medium">Resolved</span>
            ) : null}
          </div>
          <p className="text-xs text-gray-400 mt-0.5 whitespace-pre-wrap break-words">
            {comment.content}
          </p>
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex items-center gap-2 mt-1 ml-7">
          {!isReply && onReply && (
            <button onClick={onReply} className="text-[9px] text-gray-600 hover:text-gray-400">Reply</button>
          )}
          {!isReply && onResolve && (
            <button
              onClick={() => onResolve(comment.id, !comment.resolved)}
              className="text-[9px] text-gray-600 hover:text-green-400"
            >
              {comment.resolved ? 'Unresolve' : 'Resolve'}
            </button>
          )}
          {isOwner && onDelete && (
            <button onClick={() => onDelete(comment.id)} className="text-[9px] text-gray-600 hover:text-red-400">Delete</button>
          )}
        </div>
      )}
    </div>
  );
}
