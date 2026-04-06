import React, { useMemo } from 'react';
import { useStore, useReactFlow } from '@xyflow/react';

const SNAP_THRESHOLD = 8;
const GUIDE_COLOR = '#0ea5e9';
const GUIDE_EXTEND = 20;

/**
 * Renders alignment guide lines on the React Flow canvas when a node
 * is being dragged near the edges/center of other nodes.
 * Must be placed as a child of <ReactFlow>.
 */
export default function AlignmentGuides() {
  // Get all nodes from the React Flow internal store
  const nodes = useStore((s) => s.nodes);
  const dragging = useStore((s) =>
    s.nodes.find((n) => n.dragging)
  );

  const guides = useMemo(() => {
    if (!dragging) return [];

    const result = [];
    const dX = dragging.position.x;
    const dY = dragging.position.y;
    const dW = dragging.measured?.width || 220;
    const dH = dragging.measured?.height || 80;
    const dCX = dX + dW / 2;
    const dCY = dY + dH / 2;
    const dR = dX + dW;
    const dB = dY + dH;

    for (const node of nodes) {
      if (node.id === dragging.id) continue;

      const nW = node.measured?.width || 220;
      const nH = node.measured?.height || 80;
      const nX = node.position.x;
      const nY = node.position.y;
      const nCX = nX + nW / 2;
      const nCY = nY + nH / 2;
      const nR = nX + nW;
      const nB = nY + nH;

      // All y-extents for vertical lines
      const allYs = [dY, dB, nY, nB];
      const minY = Math.min(...allYs) - GUIDE_EXTEND;
      const maxY = Math.max(...allYs) + GUIDE_EXTEND;

      // All x-extents for horizontal lines
      const allXs = [dX, dR, nX, nR];
      const minX = Math.min(...allXs) - GUIDE_EXTEND;
      const maxX = Math.max(...allXs) + GUIDE_EXTEND;

      // Vertical guides (x-axis alignment)
      if (Math.abs(dX - nX) < SNAP_THRESHOLD) {
        result.push({ type: 'v', x: nX, y1: minY, y2: maxY });
      }
      if (Math.abs(dCX - nCX) < SNAP_THRESHOLD) {
        result.push({ type: 'v', x: nCX, y1: minY, y2: maxY });
      }
      if (Math.abs(dR - nR) < SNAP_THRESHOLD) {
        result.push({ type: 'v', x: nR, y1: minY, y2: maxY });
      }

      // Horizontal guides (y-axis alignment)
      if (Math.abs(dY - nY) < SNAP_THRESHOLD) {
        result.push({ type: 'h', y: nY, x1: minX, x2: maxX });
      }
      if (Math.abs(dCY - nCY) < SNAP_THRESHOLD) {
        result.push({ type: 'h', y: nCY, x1: minX, x2: maxX });
      }
      if (Math.abs(dB - nB) < SNAP_THRESHOLD) {
        result.push({ type: 'h', y: nB, x1: minX, x2: maxX });
      }
    }

    // Deduplicate close guides
    const seen = new Set();
    return result.filter((g) => {
      const key = g.type === 'v' ? `v:${Math.round(g.x)}` : `h:${Math.round(g.y)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [dragging?.id, dragging?.position?.x, dragging?.position?.y, nodes]);

  if (!guides.length) return null;

  return (
    <svg className="react-flow__alignment-guides" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
      {guides.map((g, i) =>
        g.type === 'v' ? (
          <line
            key={`v-${i}`}
            x1={g.x}
            y1={g.y1}
            x2={g.x}
            y2={g.y2}
            stroke={GUIDE_COLOR}
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.7}
          />
        ) : (
          <line
            key={`h-${i}`}
            x1={g.x1}
            y1={g.y}
            x2={g.x2}
            y2={g.y}
            stroke={GUIDE_COLOR}
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.7}
          />
        )
      )}
    </svg>
  );
}
