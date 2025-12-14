import { getSmartEdge } from '@tisoap/react-flow-smart-edge';
import { type FC } from 'react';
import { BaseEdge, EdgeLabelRenderer, SmoothStepEdge, useNodes } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

const SmartEdge: FC<EdgeProps> = (props) => {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
  } = props;
  const nodes = useNodes();

  const getSmartEdgeResponse = getSmartEdge({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    nodes,
    options: {
      nodePadding: 20,
      gridRatio: 10,
    },
  });

  if (getSmartEdgeResponse instanceof Error) {
    // Fallback to a different edge type if pathfinding fails
    return <SmoothStepEdge {...props} />;
  }

  const { edgeCenterX, edgeCenterY, svgPathString } = getSmartEdgeResponse;

  return (
    <>
      <BaseEdge id={id} path={svgPathString} style={style} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${edgeCenterX}px,${edgeCenterY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          {/* You can add a label here if you want */}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default SmartEdge;
