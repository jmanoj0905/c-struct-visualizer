import { useCallback } from 'react';
import { useStore, getSmoothStepPath } from '@xyflow/react';
import type { EdgeProps, Node } from '@xyflow/react';
import { getNodeIntersection } from './FloatingEdgeUtils';

// Helper to get node by id
function getNodeById(nodes: Node[], id: string) {
  return nodes.find((node) => node.id === id);
}

export default function FloatingEdge({
  id,
  source,
  target,
  markerEnd,
  style,
}: EdgeProps) {
  const sourceNode = useStore(useCallback((store) => getNodeById(store.nodes, source), [source]));
  const targetNode = useStore(useCallback((store) => getNodeById(store.nodes, target), [target]));

  if (!sourceNode || !targetNode) {
    return null;
  }

  const { sx, sy, tx, ty } = getNodeIntersection(sourceNode, targetNode);

  // Create orthogonal path with mandatory horizontal extension
  const HORIZONTAL_EXTENSION = 50;

  // Determine direction
  const goingRight = tx > sx;
  const extendX = goingRight ? sx + HORIZONTAL_EXTENSION : sx - HORIZONTAL_EXTENSION;

  // Build simple orthogonal path: horizontal -> vertical -> horizontal
  const path = `M ${sx},${sy} L ${extendX},${sy} L ${extendX},${ty} L ${tx},${ty}`;

  return (
    <path
      id={id}
      className="react-flow__edge-path"
      d={path}
      markerEnd={markerEnd}
      style={style}
      fill="none"
      strokeWidth={2}
    />
  );
}
