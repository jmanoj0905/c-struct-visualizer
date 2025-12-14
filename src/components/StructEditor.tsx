import { useState, useMemo } from "react";
import {
  FileCode,
  X,
  CheckCircle,
  AlertCircle,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { useCanvasStore } from "../store/canvasStore";
import {
  parseStruct,
  validateStructCode,
  canConnectPointer,
  resolveTypeName,
} from "../parser/structParser";
import { Button } from "./ui/button";
import { Alert, AlertDescription } from "./ui/alert";
import { UI_COLORS } from "../utils/colors";
import { showAlert } from "./AlertContainer";

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
    connections,
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
} Node_t;`;

  const [code, setCode] = useState(defaultCode);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Real-time validation using useMemo instead of setState in effect
  const validationErrors = useMemo(() => {
    return validateStructCode(
      code,
      structDefinitions,
      !!editStructName,
      editStructName,
    );
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

    showAlert({
      type: "confirm",
      message: confirmMessage,
      onConfirm: () => {
        deleteStructDefinition(editStructName);
        onClose();
      },
      confirmText: "Delete",
      cancelText: "Cancel",
    });
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

      // Check if this update will invalidate any connections
      const updatedStructDefinitions = structDefinitions.map((s) =>
        s.name === editStructName ? parsed : s,
      );

      const affectedConnections = connections.filter((conn) => {
        const sourceInstance = instances.find(
          (i) => i.id === conn.sourceInstanceId,
        );
        const targetInstance = instances.find(
          (i) => i.id === conn.targetInstanceId,
        );

        if (!sourceInstance || !targetInstance) return false;

        // Only check connections from instances of this struct
        if (sourceInstance.structName !== editStructName) return false;

        const sourceStruct = updatedStructDefinitions.find(
          (s) => s.name === sourceInstance.structName,
        );

        if (!sourceStruct) return false;

        const baseFieldName = conn.sourceFieldName.split("[")[0];
        const sourceField = sourceStruct.fields.find(
          (f) => f.name === baseFieldName,
        );

        // Connection will be removed if:
        // 1. Field doesn't exist anymore
        // 2. Field is no longer a pointer
        // 3. Pointer type no longer matches target
        if (!sourceField || !sourceField.isPointer) return true;

        const resolvedPointerType = resolveTypeName(
          sourceField.type,
          updatedStructDefinitions,
        );
        const resolvedTargetType = resolveTypeName(
          targetInstance.structName,
          updatedStructDefinitions,
        );

        return !canConnectPointer(resolvedPointerType, resolvedTargetType);
      });

      // If connections will be removed, show confirmation
      if (affectedConnections.length > 0) {
        showAlert({
          type: "confirm",
          message: `Updating this struct will remove ${affectedConnections.length} connection${affectedConnections.length === 1 ? "" : "s"} that are no longer valid.\n\nDo you want to continue?`,
          onConfirm: () => {
            updateStructDefinition(editStructName, parsed);
            setSuccess(true);
            setTimeout(() => {
              onClose();
            }, 1500);
          },
          confirmText: "Update",
          cancelText: "Cancel",
        });
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 modal-backdrop">
      <div className="bg-white rounded-base shadow-shadow w-full max-w-2xl mx-4 border-2 border-black animate-scaleIn">
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
          <div className="border-2 border-black rounded-base overflow-hidden">
            <CodeMirror
              value={code}
              height="300px"
              extensions={[cpp()]}
              onChange={(value) => setCode(value)}
              theme="light"
              basicSetup={{
                lineNumbers: true,
                highlightActiveLineGutter: true,
                highlightSpecialChars: true,
                foldGutter: true,
                drawSelection: true,
                dropCursor: true,
                allowMultipleSelections: true,
                indentOnInput: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
                rectangularSelection: true,
                crosshairCursor: true,
                highlightActiveLine: true,
                highlightSelectionMatches: true,
                closeBracketsKeymap: true,
                searchKeymap: true,
                foldKeymap: true,
                completionKeymap: true,
                lintKeymap: true,
              }}
              className="font-mono text-sm"
            />
          </div>

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
