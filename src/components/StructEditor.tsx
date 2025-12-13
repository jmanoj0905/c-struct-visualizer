import { useState } from "react";
import { FileCode, X, CheckCircle, AlertCircle, Trash2 } from "lucide-react";
import { useCanvasStore } from "../store/canvasStore";
import { parseStruct } from "../parser/structParser";

interface Props {
  onClose: () => void;
  editStructName?: string;
}

export default function StructEditor({ onClose, editStructName }: Props) {
  const {
    addStructDefinition,
    updateStructDefinition,
    deleteStructDefinition,
    structDefinitions,
    instances,
  } = useCanvasStore();

  // Load existing struct if editing
  const existingStruct = editStructName
    ? structDefinitions.find((s) => s.name === editStructName)
    : null;

  const defaultCode = existingStruct
    ? existingStruct.typedef
      ? `typedef struct ${existingStruct.name} {
${existingStruct.fields
  .map((f) => {
    let fieldDef = `  ${f.type}`;
    if (f.isPointer) fieldDef += "*";
    fieldDef += ` ${f.name}`;
    if (f.isArray) fieldDef += `[${f.arraySize}]`;
    fieldDef += ";";
    return fieldDef;
  })
  .join("\n")}
} ${existingStruct.typedef};`
      : `struct ${existingStruct.name} {
${existingStruct.fields
  .map((f) => {
    let fieldDef = `  ${f.type}`;
    if (f.isPointer) fieldDef += "*";
    fieldDef += ` ${f.name}`;
    if (f.isArray) fieldDef += `[${f.arraySize}]`;
    fieldDef += ";";
    return fieldDef;
  })
  .join("\n")}
};`
    : `typedef struct Node {
  int data;
  struct Node* next;
} Node;`;

  const [code, setCode] = useState(defaultCode);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleDelete = () => {
    if (!editStructName) return;

    // Count instances of this struct
    const instanceCount = instances.filter(
      (inst) => inst.structName === editStructName,
    ).length;

    let confirmMessage = "";
    if (instanceCount > 0) {
      confirmMessage = `Warning: There ${instanceCount === 1 ? "is" : "are"} ${instanceCount} instance${instanceCount === 1 ? "" : "s"} of "${editStructName}" in the workspace.\n\nDeleting this struct will also remove all ${instanceCount} instance${instanceCount === 1 ? "" : "s"} from the workspace.\n\nAre you sure you want to delete?`;
    } else {
      confirmMessage = `Are you sure you want to delete struct "${editStructName}"?`;
    }

    if (window.confirm(confirmMessage)) {
      deleteStructDefinition(editStructName);
      onClose();
    }
  };

  const handleParse = () => {
    setError(null);
    setSuccess(false);

    const parsed = parseStruct(code);

    if (!parsed) {
      setError("Failed to parse struct. Check your syntax!");
      return;
    }

    if (editStructName) {
      // Update existing struct
      if (
        parsed.name !== editStructName &&
        structDefinitions.some((s) => s.name === parsed.name)
      ) {
        setError(`Struct "${parsed.name}" already exists!`);
        return;
      }
      updateStructDefinition(editStructName, parsed);
      setSuccess(true);
    } else {
      // Add new struct
      if (structDefinitions.some((s) => s.name === parsed.name)) {
        setError(`Struct "${parsed.name}" already exists!`);
        return;
      }
      addStructDefinition(parsed);
      setSuccess(true);
    }

    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-2xl mx-4 border-4 border-black">
        {/* Header */}
        <div className="bg-[#80DEEA] px-6 py-3 border-b-4 border-black flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileCode size={20} strokeWidth={2.5} />
            <h2 className="text-sm font-mono font-bold tracking-tight">
              {editStructName ? editStructName : "STRUCT"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="bg-red-300 border-2 border-black p-1.5 rounded-none transition shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Editor */}
        <div className="p-6">
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              // Handle Tab key to insert tab instead of moving focus
              if (e.key === "Tab") {
                e.preventDefault();
                const start = e.currentTarget.selectionStart;
                const end = e.currentTarget.selectionEnd;
                const newCode =
                  code.substring(0, start) + "  " + code.substring(end);
                setCode(newCode);
                // Set cursor position after the inserted tab
                setTimeout(() => {
                  e.currentTarget.selectionStart =
                    e.currentTarget.selectionEnd = start + 2;
                }, 0);
              }
            }}
            className="w-full h-64 p-4 border-3 border-black rounded-none font-mono text-xs font-semibold focus:outline-none focus:ring-0 bg-yellow-50 resize-none"
            placeholder="struct MyStruct { ... };"
            spellCheck={false}
          />

          {/* Error/Success messages */}
          {error && (
            <div className="mt-4 p-2.5 bg-red-200 border-3 border-black rounded-none flex items-center gap-2 text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <AlertCircle size={16} strokeWidth={2.5} />
              <span className="font-mono font-bold">{error}</span>
            </div>
          )}

          {success && (
            <div className="mt-4 p-2.5 bg-green-200 border-3 border-black rounded-none flex items-center gap-2 text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <CheckCircle size={16} strokeWidth={2.5} />
              <span className="font-mono font-bold">Saved</span>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex gap-2 justify-between">
            {/* Delete button (only show when editing) */}
            {editStructName && (
              <button
                onClick={handleDelete}
                className="p-2 bg-[#EF9A9A] rounded-none transition shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 flex items-center gap-2 border-4 border-black"
                title="Delete"
              >
                <Trash2 size={16} strokeWidth={2.5} />
              </button>
            )}

            <div className="flex gap-2 ml-auto">
              <button
                onClick={onClose}
                className="px-4 py-2 border-3 border-black rounded-none bg-gray-200 transition text-xs font-mono font-bold shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5"
              >
                esc
              </button>
              <button
                onClick={handleParse}
                className="px-4 py-2 bg-[#A5D6A7] rounded-none transition shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 text-xs font-mono font-bold border-4 border-black"
              >
                {editStructName ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
