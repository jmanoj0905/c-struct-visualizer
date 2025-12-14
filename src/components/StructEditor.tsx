import { useState, useEffect } from "react";
import {
  FileCode,
  X,
  CheckCircle,
  AlertCircle,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { useCanvasStore } from "../store/canvasStore";
import {
  parseStruct,
  validateStructCode,
  type ValidationError,
} from "../parser/structParser";
import { Button } from "./ui/button";
import { Alert, AlertDescription } from "./ui/alert";
import { UI_COLORS } from "../utils/colors";

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
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    [],
  );

  // Real-time validation
  useEffect(() => {
    const errors = validateStructCode(
      code,
      structDefinitions,
      !!editStructName,
      editStructName,
    );
    setValidationErrors(errors);
  }, [code, structDefinitions, editStructName]);

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

    // Check for validation errors first
    if (validationErrors.some((e) => e.type === "error")) {
      setError("Please fix all errors before saving!");
      return;
    }

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
      <div className="bg-white rounded-base shadow-shadow w-full max-w-2xl mx-4 border-2 border-black">
        {/* Header */}
        <div
          className="px-6 py-3 border-b-2 border-black flex items-center justify-between"
          style={{ backgroundColor: UI_COLORS.cyan }}
        >
          <div className="flex items-center gap-3">
            <FileCode size={20} strokeWidth={2.5} />
            <h2 className="text-sm font-mono font-heading tracking-tight">
              {editStructName ? editStructName : "STRUCT"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="border-2 border-black p-1.5 rounded-base transition"
            style={{ backgroundColor: UI_COLORS.redDelete }}
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
            className="w-full h-64 p-4 border-2 border-black rounded-base font-mono text-xs font-base focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 bg-secondary-background resize-none"
            placeholder="struct MyStruct { ... };"
            spellCheck={false}
          />

          {/* Real-time validation errors/warnings */}
          {validationErrors.length > 0 && !error && !success && (
            <div className="mt-3 space-y-2 max-h-32 overflow-y-auto">
              {validationErrors.map((err, idx) => (
                <div
                  key={idx}
                  className={`p-2 border-2 border-black rounded-base flex items-start gap-2 text-xs ${
                    err.type === "error" ? "bg-red-100" : "bg-yellow-100"
                  }`}
                >
                  {err.type === "error" ? (
                    <AlertCircle
                      size={14}
                      strokeWidth={2.5}
                      className="flex-shrink-0 mt-0.5"
                    />
                  ) : (
                    <AlertTriangle
                      size={14}
                      strokeWidth={2.5}
                      className="flex-shrink-0 mt-0.5"
                    />
                  )}
                  <div className="flex-1">
                    <span className="font-heading">Line {err.line}:</span>{" "}
                    <span className="font-base">{err.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error/Success messages */}
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle size={16} strokeWidth={2.5} />
              <AlertDescription className="font-mono font-base">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert
              className="mt-4"
              style={{ backgroundColor: UI_COLORS.green }}
            >
              <CheckCircle size={16} strokeWidth={2.5} />
              <AlertDescription className="font-mono font-base">
                Saved
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="mt-6 flex gap-2 justify-between">
            {/* Delete button (only show when editing) */}
            {editStructName && (
              <Button
                onClick={handleDelete}
                size="icon"
                style={{ backgroundColor: UI_COLORS.redDelete }}
                title="Delete"
              >
                <Trash2 size={16} strokeWidth={2.5} />
              </Button>
            )}

            <div className="flex gap-2 ml-auto">
              <Button onClick={onClose} variant="neutral">
                esc
              </Button>
              <Button
                onClick={handleParse}
                style={{ backgroundColor: UI_COLORS.green }}
              >
                {editStructName ? "Save" : "Add"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
