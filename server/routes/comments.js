const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { db } = require('../db');
const { requireAuth } = require('../middleware');

router.use(requireAuth);

function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

// Helper: check if user can access this build
async function checkBuildAccess(buildId, userId) {
  // Owner?
  const owned = await db.getAsync(
    `SELECT id FROM agent_builds WHERE id = ? AND user_id = ?`,
    [buildId, userId]
  );
  if (owned) return 'owner';

  // Shared with edit?
  const user = await db.getAsync(`SELECT email FROM rumi_users WHERE id = ?`, [userId]);
  if (user) {
    const share = await db.getAsync(
      `SELECT permission FROM agent_shares
       WHERE build_id = ? AND shared_with_email = ?
       AND (expires_at IS NULL OR expires_at > datetime('now'))`,
      [buildId, user.email]
    );
    if (share) return share.permission;
  }

  // Org member?
  const orgAgent = await db.getAsync(
    `SELECT a.org_id FROM agent_builds a
     JOIN org_members m ON m.org_id = a.org_id AND m.user_id = ? AND m.joined_at IS NOT NULL
     WHERE a.id = ? AND a.visibility = 'org'`,
    [userId, buildId]
  );
  if (orgAgent) return 'edit';

  return null;
}

/** Share links with permission `view` are read-only: no create/edit/delete/resolve on comments. */
function canMutateComments(access) {
  return access === 'owner' || access === 'edit';
}

// List comments for a build
router.get('/:buildId', async (req, res) => {
  try {
    const access = await checkBuildAccess(req.params.buildId, req.user.user_id);
    if (!access) return res.status(403).json({ error: 'No access to this agent' });

    const comments = await db.allAsync(
      `SELECT c.*, u.name as user_name, u.email as user_email
       FROM block_comments c
       JOIN rumi_users u ON u.id = c.user_id
       WHERE c.build_id = ?
       ORDER BY c.created_at ASC`,
      [req.params.buildId]
    );

    res.json({ comments });
  } catch (err) {
    console.error('[Comments] List error:', err);
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

// Add a comment
router.post('/:buildId', async (req, res) => {
  try {
    const { nodeId, content, parentId } = req.body;
    if (!nodeId || !content?.trim()) {
      return res.status(400).json({ error: 'nodeId and content are required' });
    }

    const access = await checkBuildAccess(req.params.buildId, req.user.user_id);
    if (!access) return res.status(403).json({ error: 'No access to this agent' });
    if (!canMutateComments(access)) {
      return res.status(403).json({ error: 'Read-only access: commenting is not allowed for this link' });
    }

    const id = generateId();
    await db.runAsync(
      `INSERT INTO block_comments (id, build_id, node_id, user_id, content, parent_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, req.params.buildId, nodeId, req.user.user_id, content.trim(), parentId || null]
    );

    const comment = await db.getAsync(
      `SELECT c.*, u.name as user_name, u.email as user_email
       FROM block_comments c
       JOIN rumi_users u ON u.id = c.user_id
       WHERE c.id = ?`,
      [id]
    );

    res.json({ comment });
  } catch (err) {
    console.error('[Comments] Create error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Update a comment
router.put('/:commentId', async (req, res) => {
  try {
    const comment = await db.getAsync(
      `SELECT * FROM block_comments WHERE id = ?`,
      [req.params.commentId]
    );
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const access = await checkBuildAccess(comment.build_id, req.user.user_id);
    if (!access) return res.status(403).json({ error: 'No access to this agent' });
    if (!canMutateComments(access)) {
      return res.status(403).json({ error: 'Read-only access: cannot edit comments' });
    }

    if (comment.user_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Can only edit your own comments' });
    }

    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content is required' });

    await db.runAsync(
      `UPDATE block_comments SET content = ?, updated_at = datetime('now') WHERE id = ?`,
      [content.trim(), req.params.commentId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[Comments] Update error:', err);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

// Resolve/unresolve a comment
router.put('/:commentId/resolve', async (req, res) => {
  try {
    const comment = await db.getAsync(
      `SELECT * FROM block_comments WHERE id = ?`,
      [req.params.commentId]
    );
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const access = await checkBuildAccess(comment.build_id, req.user.user_id);
    if (!access) return res.status(403).json({ error: 'No access to this agent' });
    if (!canMutateComments(access)) {
      return res.status(403).json({ error: 'Read-only access: cannot resolve comments' });
    }

    const resolved = req.body.resolved ? 1 : 0;
    await db.runAsync(
      `UPDATE block_comments SET resolved = ?, updated_at = datetime('now') WHERE id = ?`,
      [resolved, req.params.commentId]
    );

    res.json({ ok: true, resolved: !!resolved });
  } catch (err) {
    console.error('[Comments] Resolve error:', err);
    res.status(500).json({ error: 'Failed to resolve comment' });
  }
});

// Delete a comment
router.delete('/:commentId', async (req, res) => {
  try {
    const comment = await db.getAsync(
      `SELECT * FROM block_comments WHERE id = ?`,
      [req.params.commentId]
    );
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const access = await checkBuildAccess(comment.build_id, req.user.user_id);
    if (!access) return res.status(403).json({ error: 'No access to this agent' });
    if (!canMutateComments(access)) {
      return res.status(403).json({ error: 'Read-only access: cannot delete comments' });
    }

    // Owner of comment or owner of agent can delete
    if (comment.user_id !== req.user.user_id) {
      const agent = await db.getAsync(
        `SELECT user_id FROM agent_builds WHERE id = ?`,
        [comment.build_id]
      );
      if (!agent || agent.user_id !== req.user.user_id) {
        return res.status(403).json({ error: 'No permission to delete this comment' });
      }
    }

    // Delete comment and its replies
    await db.runAsync(
      `DELETE FROM block_comments WHERE id = ? OR parent_id = ?`,
      [req.params.commentId, req.params.commentId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[Comments] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

module.exports = router;
