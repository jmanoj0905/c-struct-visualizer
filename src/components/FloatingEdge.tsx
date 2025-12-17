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

  const [edgePath] = getSmoothStepPath({
    sourceX: sx,
    sourceY: sy,
    targetX: tx,
    targetY: ty,
  });

  return (
    <path
      id={id}
      className="react-flow__edge-path"
      d={edgePath}
      markerEnd={markerEnd}
      style={style}
    />
  );
}
