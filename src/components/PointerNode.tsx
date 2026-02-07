import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Trash2 } from "lucide-react";
import { useCanvasStore } from "../store/canvasStore";
import { UI_COLORS } from "../utils/colors";

interface PointerNodeData {
  pointerInstanceId: string;
  name: string;
  type: string;
  pointerLevel: number;
  targetInstanceId: string | null;
  targetFieldName: string | null;
  color: string;
}

function PointerNode({
  data,
  selected,
}: {
  data: PointerNodeData;
  selected?: boolean;
}) {
  const { removePointerInstance, instances, pointerInstances } =
    useCanvasStore();

  const targetInstance = data.targetInstanceId
    ? instances.find((i) => i.id === data.targetInstanceId)
    : null;

  const targetPointer = !targetInstance && data.targetInstanceId
    ? pointerInstances.find((pi) => pi.id === data.targetInstanceId)
    : null;

  const stars = "*".repeat(data.pointerLevel);

  return (
    <div
      className={`group/card bg-white rounded-base shadow-shadow border-2 min-w-[160px] ${
        selected
          ? "border-blue-600 ring-4 ring-blue-400 ring-opacity-50"
          : "border-black"
      }`}
    >
      {/* Target handle - left (so other pointers can connect TO this node) */}
      <Handle
        type="target"
        position={Position.Left}
        id={`pointer-target-${data.pointerInstanceId}`}
        className="!bg-black !w-3.5 !h-3.5 !border-2 !border-white !rounded-full"
        style={{ top: "28px" }}
        isConnectable={true}
      />

      {/* Header */}
      <div
        className="px-3 py-1.5 border-b-2 border-black flex justify-between items-center"
        style={{ backgroundColor: data.color }}
      >
        <div className="font-mono font-heading text-xs text-black">
          {data.type}
          {stars}
        </div>
        <button
          onClick={() => removePointerInstance(data.pointerInstanceId)}
          className="opacity-0 group-hover/card:opacity-100 size-6 border-2 border-black rounded-base inline-flex items-center justify-center transition"
          style={{ backgroundColor: UI_COLORS.redDelete }}
          title="Delete"
        >
          <Trash2 size={12} strokeWidth={2.5} />
        </button>
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        <div className="font-mono font-heading text-sm mb-1">{data.name}</div>
        {targetInstance ? (
          <div
            className="flex items-center gap-1.5 text-xs font-heading font-mono border-2 border-black px-2 py-0.5 rounded-base"
            style={{ backgroundColor: UI_COLORS.green }}
          >
            <span className="inline-block w-2 h-2 bg-black rounded-none" />
            {data.targetFieldName
              ? `&${targetInstance.instanceName}.${data.targetFieldName}`
              : targetInstance.instanceName}
          </div>
        ) : targetPointer ? (
          <div
            className="flex items-center gap-1.5 text-xs font-heading font-mono border-2 border-black px-2 py-0.5 rounded-base"
            style={{ backgroundColor: UI_COLORS.green }}
          >
            <span className="inline-block w-2 h-2 bg-black rounded-none" />
            {targetPointer.name}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-base font-mono">
            <span className="inline-block w-2 h-2 bg-gray-400 rounded-none" />
            NULL
          </div>
        )}
      </div>

      {/* Source handle (right side) */}
      <Handle
        type="source"
        position={Position.Right}
        id={`pointer-source-${data.pointerInstanceId}`}
        className="!bg-black !w-3.5 !h-3.5 !border-2 !border-white cursor-pointer !rounded-full"
        title={`Connect ${data.name}`}
      />
    </div>
  );
}

export default memo(PointerNode);
