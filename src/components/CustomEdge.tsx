import type { FC } from "react";
import type { EdgeProps } from "@xyflow/react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from "@xyflow/react";
import { useCanvasStore } from "../store/canvasStore";

const CustomEdge: FC<EdgeProps> = (props) => {
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
    data,
  } = props;

  const { connections, instances, structDefinitions } = useCanvasStore();

  // Use React Flow's built-in smooth step path
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 0,
    offset: 20,
  });

  // Get connection info for tooltip
  const connection = connections.find((conn) => conn.id === data?.connectionId);
  let pointerType = "";
  if (connection) {
    const sourceInstance = instances.find(
      (i) => i.id === connection.sourceInstanceId,
    );
    if (sourceInstance) {
      const struct = structDefinitions.find(
        (s) => s.name === sourceInstance.structName,
      );
      if (struct) {
        const fieldName = connection.sourceFieldName.split("[")[0]; // Handle array notation
        const field = struct.fields.find((f) => f.name === fieldName);
        if (field) {
          pointerType = `${field.type}*`;
        }
      }
    }
  }

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {pointerType && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan opacity-0 hover:opacity-100 transition-opacity bg-[#DDA0DD] border-3 border-black text-xs px-2 py-1 rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] font-mono font-bold"
          >
            {pointerType}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default CustomEdge;
