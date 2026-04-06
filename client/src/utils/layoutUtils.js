import dagre from 'dagre';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;
const TYPE_PRIORITY = {
  input: 0,
  knowledge: 1,
  instructions: 2,
  llm: 3,
  tools: 4,
  memory: 5,
  guardrails: 6,
  variable: 7,
  condition: 8,
  loop: 9,
  subagent: 10,
  connector: 11,
  output: 12,
  agentIntro: 13,
  fileResources: 14,
};

/**
 * Auto-layout nodes using dagre directed graph layout.
 * Arranges nodes top-to-bottom following data flow with minimal edge crossings.
 */
export function autoLayout(nodes, edges, direction = 'TB') {
  if (!nodes.length) return { nodes, edges };

  try {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    const dense = nodes.length > 12;
    g.setGraph({
      rankdir: direction,
      ranker: 'network-simplex',
      acyclicer: 'greedy',
      align: 'UL',
      nodesep: dense ? 96 : 84,
      ranksep: dense ? 150 : 130,
      edgesep: dense ? 72 : 58,
      marginx: 40,
      marginy: 40,
    });

    const validNodeIds = new Set();
    // Add nodes
    nodes.forEach((node) => {
      if (!node?.id) return;
      const w = node.measured?.width || NODE_WIDTH;
      const h = node.measured?.height || NODE_HEIGHT;
      g.setNode(node.id, { width: w, height: h });
      validNodeIds.add(node.id);
    });

    // Add edges (sanitize partial/invalid edge data to avoid dagre runtime errors)
    edges
      .filter((edge) => edge?.source && edge?.target && validNodeIds.has(edge.source) && validNodeIds.has(edge.target))
      .forEach((edge) => {
        g.setEdge(edge.source, edge.target, { weight: 3, minlen: 1 });
      });

    // Keep disconnected/source nodes in deterministic flow order to reduce visual chaos.
    const incoming = new Map(nodes.filter((n) => n?.id).map((n) => [n.id, 0]));
    edges
      .filter((e) => e?.source && e?.target && validNodeIds.has(e.source) && validNodeIds.has(e.target))
      .forEach((e) => incoming.set(e.target, (incoming.get(e.target) || 0) + 1));
    const sources = nodes
      .filter((n) => n?.id && (incoming.get(n.id) || 0) === 0)
      .sort((a, b) => {
        const pa = TYPE_PRIORITY[a?.data?.blockType] ?? 99;
        const pb = TYPE_PRIORITY[b?.data?.blockType] ?? 99;
        if (pa !== pb) return pa - pb;
        return String(a?.data?.name || a.id).localeCompare(String(b?.data?.name || b.id));
      });
    for (let i = 1; i < sources.length; i += 1) {
      g.setEdge(sources[i - 1].id, sources[i].id, { weight: 0.2, minlen: 1 });
    }

    dagre.layout(g);

    // Map back to React Flow positions (dagre gives center, RF uses top-left)
    const rawLayoutedNodes = nodes.map((node) => {
      const dagreNode = node?.id ? g.node(node.id) : null;
      if (!dagreNode) return node;
      const w = node.measured?.width || NODE_WIDTH;
      const h = node.measured?.height || NODE_HEIGHT;
      return {
        ...node,
        position: {
          x: Math.round(dagreNode.x - w / 2),
          y: Math.round(dagreNode.y - h / 2),
        },
      };
    });

  // Light overlap relaxation pass to avoid near-collisions after dagre placement.
  const sorted = [...rawLayoutedNodes].sort((a, b) => {
    if (a.position.y !== b.position.y) return a.position.y - b.position.y;
    return a.position.x - b.position.x;
  });
  const occupied = [];
  const GAP_X = 44;
  const GAP_Y = 28;
  const relaxed = sorted.map((node) => {
    const w = node.measured?.width || NODE_WIDTH;
    const h = node.measured?.height || NODE_HEIGHT;
    let x = node.position.x;
    let y = node.position.y;
    let guard = 0;
    const overlaps = (ax, ay, aw, ah, bx, by, bw, bh) =>
      ax < bx + bw + GAP_X &&
      ax + aw + GAP_X > bx &&
      ay < by + bh + GAP_Y &&
      ay + ah + GAP_Y > by;

    while (occupied.some((o) => overlaps(x, y, w, h, o.x, o.y, o.w, o.h)) && guard < 50) {
      x += direction === 'LR' ? 0 : 36;
      y += direction === 'LR' ? 24 : 0;
      guard += 1;
    }
    occupied.push({ x, y, w, h });
    return { ...node, position: { x, y } };
  });

    return { nodes: relaxed, edges };
  } catch (err) {
    // Fail-safe: never break editor interactions because of layout runtime errors.
    // eslint-disable-next-line no-console
    console.error('[layoutUtils] autoLayout fallback due to error:', err);
    return { nodes, edges };
  }
}

/**
 * Compute alignment guide lines for a dragging node against all other nodes.
 * Returns arrays of { position, orientation } for rendering guides.
 */
const SNAP_THRESHOLD = 8;

export function getAlignmentGuides(draggingNode, allNodes) {
  if (!draggingNode) return [];

  const guides = [];
  const dragX = draggingNode.position.x;
  const dragY = draggingNode.position.y;
  const dragW = draggingNode.measured?.width || NODE_WIDTH;
  const dragH = draggingNode.measured?.height || NODE_HEIGHT;
  const dragCX = dragX + dragW / 2;
  const dragCY = dragY + dragH / 2;
  const dragR = dragX + dragW;
  const dragB = dragY + dragH;

  for (const node of allNodes) {
    if (node.id === draggingNode.id) continue;

    const nW = node.measured?.width || NODE_WIDTH;
    const nH = node.measured?.height || NODE_HEIGHT;
    const nX = node.position.x;
    const nY = node.position.y;
    const nCX = nX + nW / 2;
    const nCY = nY + nH / 2;
    const nR = nX + nW;
    const nB = nY + nH;

    // Vertical guides (x alignment)
    // Left-left
    if (Math.abs(dragX - nX) < SNAP_THRESHOLD) {
      guides.push({ x: nX, orientation: 'vertical' });
    }
    // Center-center
    if (Math.abs(dragCX - nCX) < SNAP_THRESHOLD) {
      guides.push({ x: nCX, orientation: 'vertical' });
    }
    // Right-right
    if (Math.abs(dragR - nR) < SNAP_THRESHOLD) {
      guides.push({ x: nR, orientation: 'vertical' });
    }

    // Horizontal guides (y alignment)
    // Top-top
    if (Math.abs(dragY - nY) < SNAP_THRESHOLD) {
      guides.push({ y: nY, orientation: 'horizontal' });
    }
    // Center-center
    if (Math.abs(dragCY - nCY) < SNAP_THRESHOLD) {
      guides.push({ y: nCY, orientation: 'horizontal' });
    }
    // Bottom-bottom
    if (Math.abs(dragB - nB) < SNAP_THRESHOLD) {
      guides.push({ y: nB, orientation: 'horizontal' });
    }
  }

  // Deduplicate
  const seen = new Set();
  return guides.filter((g) => {
    const key = g.orientation === 'vertical' ? `v:${g.x}` : `h:${g.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Snap a position to alignment guides if within threshold.
 */
export function snapToGuides(position, draggingNode, allNodes) {
  const dragW = draggingNode.measured?.width || NODE_WIDTH;
  const dragH = draggingNode.measured?.height || NODE_HEIGHT;
  let { x, y } = position;

  for (const node of allNodes) {
    if (node.id === draggingNode.id) continue;

    const nW = node.measured?.width || NODE_WIDTH;
    const nH = node.measured?.height || NODE_HEIGHT;
    const nX = node.position.x;
    const nY = node.position.y;

    // Snap X: left-left
    if (Math.abs(x - nX) < SNAP_THRESHOLD) x = nX;
    // Snap X: center-center
    else if (Math.abs((x + dragW / 2) - (nX + nW / 2)) < SNAP_THRESHOLD) x = nX + nW / 2 - dragW / 2;
    // Snap X: right-right
    else if (Math.abs((x + dragW) - (nX + nW)) < SNAP_THRESHOLD) x = nX + nW - dragW;

    // Snap Y: top-top
    if (Math.abs(y - nY) < SNAP_THRESHOLD) y = nY;
    // Snap Y: center-center
    else if (Math.abs((y + dragH / 2) - (nY + nH / 2)) < SNAP_THRESHOLD) y = nY + nH / 2 - dragH / 2;
    // Snap Y: bottom-bottom
    else if (Math.abs((y + dragH) - (nY + nH)) < SNAP_THRESHOLD) y = nY + nH - dragH;
  }

  return { x, y };
}
