import { memo, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { useCanvasStore } from "../store/canvasStore";
import { Trash2, Edit2, Check } from "lucide-react";
import { getStructColor, UI_COLORS } from "../utils/colors";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";

interface StructNodeData {
  instanceId: string;
  structName: string;
  instanceName: string;
  fields: Array<{
    name: string;
    type: string;
    isPointer: boolean;
    isArray: boolean;
    arraySize?: number;
    pointerLevel?: number;
    isFunctionPointer?: boolean;
  }>;
}

function StructNode({ data }: { data: StructNodeData }) {
  const {
    updateFieldValue,
    removeInstance,
    updateInstanceName,
    instances,
    connections,
    structDefinitions,
  } = useCanvasStore();
  const instance = instances.find((i) => i.id === data.instanceId);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(data.instanceName);

  // Get a deterministic color for this struct type
  const allStructNames = structDefinitions.map((s) => s.name);
  const structColor = getStructColor(data.structName, allStructNames);

  // Helper to check if a pointer is connected
  const isPointerConnected = (fieldName: string) => {
    return connections.some(
      (conn) =>
        conn.sourceInstanceId === data.instanceId &&
        conn.sourceFieldName === fieldName,
    );
  };

  const handleDelete = () => {
    removeInstance(data.instanceId);
  };

  const handleNameEdit = () => {
    setIsEditingName(true);
    setTempName(data.instanceName);
  };

  const handleNameSave = () => {
    if (tempName.trim()) {
      updateInstanceName(data.instanceId, tempName.trim());
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleNameSave();
    } else if (e.key === "Escape") {
      setTempName(data.instanceName);
      setIsEditingName(false);
    }
  };

  return (
    <div className="group/card bg-white rounded-base shadow-shadow border-2 border-black min-w-[280px]">
      {/* Target handle on the left (to receive pointers pointing to this instance) */}
      <Handle
        type="target"
        position={Position.Left}
        id={`target-${data.instanceId}`}
        className="!bg-black !w-6 !h-6 !border-4 !border-white !rounded-none"
        style={{ top: "50%" }}
        isConnectable={true}
      />

      {/* Header */}
      <div
        className="px-3 py-2 border-b-2 border-black flex justify-between items-center"
        style={{ backgroundColor: structColor }}
      >
        <div className="flex-1">
          <div className="text-xs font-heading font-mono">
            {data.structName}
          </div>
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onKeyDown={handleNameKeyDown}
                onBlur={handleNameSave}
                autoFocus
                className="h-7 text-sm font-heading px-2 py-0.5"
              />
              <Button
                size="icon"
                variant="noShadow"
                onClick={handleNameSave}
                className="size-7"
                style={{ backgroundColor: UI_COLORS.green }}
                title="Save"
              >
                <Check size={14} strokeWidth={2.5} />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <div className="font-mono text-sm font-heading">
                {data.instanceName}
              </div>
              <Button
                size="icon"
                variant="noShadow"
                onClick={handleNameEdit}
                className="size-7 opacity-0 group-hover:opacity-100"
                title="Edit"
              >
                <Edit2 size={12} strokeWidth={2.5} />
              </Button>
            </div>
          )}
        </div>
        <button
          onClick={handleDelete}
          className="opacity-0 group-hover/card:opacity-100 size-8 border-2 border-black rounded-base inline-flex items-center justify-center transition"
          style={{ backgroundColor: UI_COLORS.redDelete }}
          title="Delete"
        >
          <Trash2 size={14} strokeWidth={2.5} />
        </button>
      </div>

      {/* Fields */}
      <div className="p-2 space-y-2">
        {data.fields.map((field) => {
          const fieldValue = instance?.fieldValues[field.name];
          const fieldValueStr =
            typeof fieldValue === "string" ? fieldValue : "";
          const handleId = `${data.instanceId}-${field.name}`;

          return (
            <div key={field.name} className="relative">
              {/* Field Row */}
              <div className="flex items-start gap-2 bg-white border-2 border-black p-2 rounded-base shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                {/* Field name and type */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-heading text-base tracking-tight">
                      {field.name}
                    </span>
                    {field.pointerLevel &&
                      field.pointerLevel > 1 &&
                      !field.isFunctionPointer && (
                        <span
                          className="text-[10px] border-2 border-black px-1.5 py-0.5 rounded-base font-heading"
                          style={{ backgroundColor: UI_COLORS.purple }}
                        >
                          {field.pointerLevel}x PTR
                        </span>
                      )}
                    {field.isFunctionPointer && (
                      <span
                        className="text-[10px] border-2 border-black px-1.5 py-0.5 rounded-base font-heading"
                        style={{ backgroundColor: UI_COLORS.blue }}
                      >
                        FN PTR
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-mono font-base text-gray-600 mb-1">
                    {field.isFunctionPointer
                      ? `(*${field.name})()`
                      : field.isPointer && field.isArray
                        ? `${field.type}${"*".repeat(field.pointerLevel || 1)}[${field.arraySize}]`
                        : field.isPointer
                          ? `${field.type}${"*".repeat(field.pointerLevel || 1)}`
                          : field.isArray
                            ? `${field.type}[${field.arraySize}]`
                            : field.type}
                  </div>

                  {/* Value input for non-pointer, non-array fields */}
                  {!field.isPointer &&
                    !field.isArray &&
                    field.type !== "bool" && (
                      <Input
                        type={
                          field.type === "int" ||
                          field.type === "float" ||
                          field.type === "double"
                            ? "number"
                            : "text"
                        }
                        value={fieldValueStr}
                        onChange={(e) =>
                          updateFieldValue(
                            data.instanceId,
                            field.name,
                            e.target.value,
                          )
                        }
                        placeholder={`${field.type} value`}
                        className="w-full h-9 text-sm font-base"
                      />
                    )}

                  {/* Checkbox for bool type */}
                  {!field.isPointer &&
                    !field.isArray &&
                    field.type === "bool" && (
                      <label className="flex items-center gap-2 mt-1 cursor-pointer">
                        <Checkbox
                          checked={fieldValueStr === "true"}
                          onCheckedChange={(checked) =>
                            updateFieldValue(
                              data.instanceId,
                              field.name,
                              checked ? "true" : "false",
                            )
                          }
                        />
                        <span className="text-xs font-base">
                          {fieldValueStr === "true" ? "true" : "false"}
                        </span>
                      </label>
                    )}

                  {/* Array visualization */}
                  {field.isArray && !field.isPointer && (
                    <div className="mt-2 space-y-1">
                      {Array.from({ length: field.arraySize || 0 }).map(
                        (_, idx) => {
                          const arrayValues = Array.isArray(fieldValue)
                            ? fieldValue
                            : [];
                          const value =
                            typeof arrayValues[idx] === "string"
                              ? arrayValues[idx]
                              : "";

                          return (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="text-xs font-heading w-10 text-right">
                                [{idx}]
                              </span>
                              <Input
                                type={
                                  field.type === "int" ||
                                  field.type === "float" ||
                                  field.type === "double"
                                    ? "number"
                                    : "text"
                                }
                                value={value}
                                onChange={(e) => {
                                  const newArray = [...arrayValues];
                                  newArray[idx] = e.target.value;
                                  updateFieldValue(
                                    data.instanceId,
                                    field.name,
                                    newArray,
                                  );
                                }}
                                placeholder={field.type}
                                className="flex-1 h-8 text-sm"
                              />
                            </div>
                          );
                        },
                      )}
                    </div>
                  )}

                  {/* Array of pointers visualization */}
                  {field.isPointer && field.isArray && (
                    <div className="mt-2 space-y-1">
                      {Array.from({ length: field.arraySize || 0 }).map(
                        (_, idx) => {
                          const arrayFieldName = `${field.name}[${idx}]`;
                          const isConnected = connections.some(
                            (conn) =>
                              conn.sourceInstanceId === data.instanceId &&
                              conn.sourceFieldName === arrayFieldName,
                          );

                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-2 relative pr-6"
                            >
                              <span className="text-xs font-heading w-10 text-right">
                                [{idx}]
                              </span>
                              <div className="flex-1">
                                {isConnected ? (
                                  <div
                                    className="flex items-center gap-2 text-sm font-heading font-mono border-2 border-black px-2 py-0.5 rounded-base"
                                    style={{ backgroundColor: UI_COLORS.green }}
                                  >
                                    <span className="inline-block w-2.5 h-2.5 bg-black rounded-none"></span>
                                    CONNECTED
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-xs text-gray-500 font-base font-mono">
                                    <span className="inline-block w-2 h-2 bg-gray-400 rounded-none"></span>
                                    NULL
                                  </div>
                                )}
                              </div>
                              {/* Source handle for each array element */}
                              <Handle
                                type="source"
                                position={Position.Right}
                                id={`${data.instanceId}-${arrayFieldName}`}
                                data-field-type={field.type}
                                data-field-name={arrayFieldName}
                                data-is-pointer="true"
                                className="!bg-black !w-5 !h-5 !border-3 !border-white hover:!w-6 hover:!h-6 transition-all cursor-pointer !absolute !right-0 !rounded-none"
                                style={{
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                }}
                                title={`Connect ${field.name}[${idx}]`}
                              />
                            </div>
                          );
                        },
                      )}
                    </div>
                  )}

                  {/* Pointer status indicator (single pointer, not array) */}
                  {field.isPointer && !field.isArray && (
                    <div>
                      {isPointerConnected(field.name) ? (
                        <div
                          className="flex items-center gap-2 text-sm font-heading font-mono border-2 border-black px-2 py-1 rounded-base shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]"
                          style={{ backgroundColor: UI_COLORS.green }}
                        >
                          <span className="inline-block w-2.5 h-2.5 bg-black rounded-none"></span>
                          CONNECTED
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-gray-500 font-base font-mono">
                          <span className="inline-block w-2 h-2 bg-gray-400 rounded-none"></span>
                          NULL
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Source handle (gray circle) for single pointers on the right */}
                {field.isPointer && !field.isArray && (
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={handleId}
                    data-field-type={field.type}
                    data-field-name={field.name}
                    data-is-pointer="true"
                    className="!bg-black !w-6 !h-6 !border-4 !border-white hover:!w-7 hover:!h-7 transition-all cursor-pointer !rounded-none"
                    title={`Connect ${field.name}`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(StructNode);
