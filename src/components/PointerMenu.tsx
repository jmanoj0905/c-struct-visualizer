import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  X,
  Plus,
  MousePointer2,
  Edit2,
  Check,
} from "lucide-react";
import { useCanvasStore } from "../store/canvasStore";
import { parsePointerDeclaration } from "../parser/structParser";
import { UI_COLORS, getPointerColor } from "../utils/colors";
import { Input } from "./ui/input";
import { showAlert } from "./AlertContainer";

interface PointerMenuProps {
  isOpen: boolean;
  onToggle: () => void;
}

const PointerMenu = ({ isOpen, onToggle }: PointerMenuProps) => {
  const {
    pointerDefinitions,
    addPointerDefinition,
    updatePointerDefinition,
    removePointerDefinition,
    pointerInstances,
  } = useCanvasStore();
  const [input, setInput] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const result = parsePointerDeclaration(trimmed);
    if (!result) {
      setParseError('Invalid syntax. Try: "int *ptr" or "Node *head"');
      return;
    }

    // Check for duplicate name
    if (pointerDefinitions.some((p) => p.name === result.name)) {
      setParseError(`Pointer "${result.name}" already defined`);
      return;
    }

    addPointerDefinition({
      id: `ptrdef-${Date.now()}-${Math.random()}`,
      name: result.name,
      type: result.type,
      pointerLevel: result.pointerLevel,
      rawDeclaration: trimmed,
      color: getPointerColor(result.name),
    });

    setInput("");
    setParseError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAdd();
    }
  };

  const handleStartEdit = (ptr: typeof pointerDefinitions[0]) => {
    setEditingId(ptr.id);
    setEditInput(ptr.rawDeclaration);
    setEditError(null);
  };

  const handleSaveEdit = (id: string) => {
    const trimmed = editInput.trim();
    if (!trimmed) {
      setEditError("Declaration cannot be empty");
      return;
    }

    const result = parsePointerDeclaration(trimmed);
    if (!result) {
      setEditError("Invalid syntax");
      return;
    }

    // Check for duplicate name (excluding the one being edited)
    const duplicate = pointerDefinitions.find(
      (p) => p.id !== id && p.name === result.name,
    );
    if (duplicate) {
      setEditError(`Name "${result.name}" already used`);
      return;
    }

    updatePointerDefinition(id, {
      name: result.name,
      type: result.type,
      pointerLevel: result.pointerLevel,
      rawDeclaration: trimmed,
    });

    setEditingId(null);
    setEditInput("");
    setEditError(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter") {
      handleSaveEdit(id);
    } else if (e.key === "Escape") {
      setEditingId(null);
      setEditError(null);
    }
  };

  const handleDragStart = (event: React.DragEvent, pointerId: string) => {
    event.dataTransfer.setData("application/pointer", pointerId);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDeletePointer = (id: string, name: string) => {
    const instanceCount = pointerInstances.filter(
      (pi) => pi.pointerVariableId === id,
    ).length;

    if (instanceCount > 0) {
      showAlert({
        type: "confirm",
        message: `Delete pointer "${name}"? This will also remove ${instanceCount} instance${instanceCount !== 1 ? "s" : ""} from the canvas.`,
        onConfirm: () => {
          removePointerDefinition(id);
          showAlert({
            type: "success",
            message: `Pointer "${name}" deleted`,
            duration: 2000,
          });
        },
        confirmText: "Delete",
        cancelText: "Cancel",
      });
    } else {
      removePointerDefinition(id);
    }
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="fixed top-1/2 -translate-y-1/2 z-30 transition-all duration-500 ease-in-out border-2 border-black rounded-base shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
        style={{
          backgroundColor: UI_COLORS.indigo,
          right: isOpen ? "14.5rem" : "0.5rem",
          width: "2rem",
          height: "2.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        title={isOpen ? "Hide Pointers" : "Show Pointers"}
      >
        {isOpen ? (
          <ChevronRight size={18} strokeWidth={3} />
        ) : (
          <ChevronLeft size={18} strokeWidth={3} />
        )}
      </button>

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full z-20 transition-transform duration-500 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-screen w-56 bg-white border-l-4 border-black flex flex-col">
          {/* Header */}
          <div
            className="p-3 border-b-4 border-black flex items-center gap-2"
            style={{ backgroundColor: UI_COLORS.indigo }}
          >
            <MousePointer2
              size={20}
              strokeWidth={2.5}
              className="text-black"
            />
            <h2 className="text-base font-heading tracking-wider uppercase">
              Pointers
            </h2>
          </div>

          {/* Input area */}
          <div className="p-3 border-b-2 border-black space-y-2">
            <div className="flex gap-1">
              <Input
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setParseError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="int *ptr"
                className="flex-1 text-sm font-mono"
              />
              <button
                onClick={handleAdd}
                className="px-2 border-2 border-black rounded-base shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
                style={{ backgroundColor: UI_COLORS.green }}
                title="Add pointer"
              >
                <Plus size={16} strokeWidth={2.5} />
              </button>
            </div>
            {parseError && (
              <div className="text-xs text-red-600 font-base">
                {parseError}
              </div>
            )}
          </div>

          {/* Pointer list */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-2">
              {pointerDefinitions.map((ptr) =>
                editingId === ptr.id ? (
                  /* Inline edit mode */
                  <div
                    key={ptr.id}
                    className="border-2 border-black rounded-base p-2 space-y-1.5"
                    style={{ backgroundColor: ptr.color }}
                  >
                    <div className="flex gap-1">
                      <Input
                        type="text"
                        value={editInput}
                        onChange={(e) => {
                          setEditInput(e.target.value);
                          setEditError(null);
                        }}
                        onKeyDown={(e) => handleEditKeyDown(e, ptr.id)}
                        autoFocus
                        className="flex-1 text-xs font-mono h-7"
                      />
                      <button
                        onClick={() => handleSaveEdit(ptr.id)}
                        className="size-7 border-2 border-black rounded-base inline-flex items-center justify-center"
                        style={{ backgroundColor: UI_COLORS.green }}
                        title="Save"
                      >
                        <Check size={12} strokeWidth={2.5} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditError(null);
                        }}
                        className="size-7 border-2 border-black rounded-base inline-flex items-center justify-center"
                        style={{ backgroundColor: UI_COLORS.redDelete }}
                        title="Cancel"
                      >
                        <X size={12} strokeWidth={2.5} />
                      </button>
                    </div>
                    {editError && (
                      <div className="text-[10px] text-red-600 font-base">
                        {editError}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Normal display mode */
                  <div
                    key={ptr.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, ptr.id)}
                    className="group border-2 border-black rounded-base p-2 cursor-move transition-all shadow-shadow hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2"
                    style={{ backgroundColor: ptr.color }}
                  >
                    <div className="text-black flex-shrink-0">
                      <GripVertical size={16} strokeWidth={2.5} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-mono font-heading text-xs truncate">
                        {ptr.name}
                      </div>
                      <div className="text-[10px] font-base text-gray-700">
                        {ptr.type}
                        {"*".repeat(ptr.pointerLevel)}
                      </div>
                    </div>

                    {/* Action buttons on hover */}
                    <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(ptr);
                        }}
                        className="size-6 p-0 border-2 border-black rounded-base inline-flex items-center justify-center"
                        style={{ backgroundColor: UI_COLORS.blue }}
                        title="Edit"
                      >
                        <Edit2 size={10} strokeWidth={2.5} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePointer(ptr.id, ptr.name);
                        }}
                        className="size-6 p-0 border-2 border-black rounded-base inline-flex items-center justify-center"
                        style={{ backgroundColor: UI_COLORS.redDelete }}
                        title="Delete"
                      >
                        <X size={10} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>

            {pointerDefinitions.length === 0 && (
              <div className="text-center text-gray-500 text-xs font-heading mt-8 mb-4">
                No pointers defined
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PointerMenu;
