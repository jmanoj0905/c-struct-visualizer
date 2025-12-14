import {
  Edit2,
  Download,
  FileCode,
  GripVertical,
  X,
  Save,
  Upload,
  List,
  GitBranch,
  Network,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { useCanvasStore } from "../store/canvasStore";
import type { CStruct } from "../types";
import { getStructColor, UI_COLORS } from "../utils/colors";
import { Button } from "./ui/button";

interface SidebarProps {
  onEditStruct: (structName: string) => void;
  onExport: () => void;
  onAddInstance: (structName: string) => void;
  onDefineStruct: () => void;
}

// Template data structures
const templates = {
  linkedList: {
    name: "Linked List",
    icon: List,
    structs: [
      {
        name: "Node",
        fields: [
          { name: "data", type: "int", isPointer: false, isArray: false },
          { name: "next", type: "Node", isPointer: true, isArray: false },
        ],
      },
    ] as CStruct[],
  },
  tree: {
    name: "Binary Tree",
    icon: GitBranch,
    structs: [
      {
        name: "TreeNode",
        fields: [
          { name: "data", type: "int", isPointer: false, isArray: false },
          { name: "left", type: "TreeNode", isPointer: true, isArray: false },
          { name: "right", type: "TreeNode", isPointer: true, isArray: false },
        ],
      },
    ] as CStruct[],
  },
  graph: {
    name: "Graph",
    icon: Network,
    structs: [
      {
        name: "GraphNode",
        fields: [
          { name: "id", type: "int", isPointer: false, isArray: false },
          {
            name: "neighbors",
            type: "GraphNode",
            isPointer: true,
            isArray: true,
            arraySize: 4,
          },
        ],
      },
    ] as CStruct[],
  },
};

const Sidebar = ({
  onEditStruct,
  onExport,
  onAddInstance,
  onDefineStruct,
}: SidebarProps) => {
  const {
    structDefinitions,
    deleteStructDefinition,
    exportWorkspace,
    importWorkspace,
    addStructDefinition,
    addInstance,
    addConnection,
  } = useCanvasStore();

  const [showTemplates, setShowTemplates] = useState(false);

  const handleDragStart = (event: React.DragEvent, structName: string) => {
    event.dataTransfer.setData("application/reactflow", structName);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDeleteStruct = (structName: string) => {
    if (
      window.confirm(
        `Delete struct "${structName}"? This will also remove all instances from the workspace.`,
      )
    ) {
      deleteStructDefinition(structName);
    }
  };

  const handleSaveWorkspace = () => {
    const data = exportWorkspace();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `c-struct-workspace-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadWorkspace = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const data = event.target?.result as string;
          importWorkspace(data);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleLoadTemplate = (templateKey: keyof typeof templates) => {
    const template = templates[templateKey];

    // Get current struct definitions to avoid duplicates
    const currentStructDefs = useCanvasStore.getState().structDefinitions;

    // Handle struct name conflicts by adding _N suffix
    const resolveStructName = (baseName: string): string => {
      let name = baseName;
      let counter = 1;
      while (currentStructDefs.some((s) => s.name === name)) {
        name = `${baseName}_${counter}`;
        counter++;
      }
      return name;
    };

    // Check if struct already exists, if so, use existing name
    const structNameMap = new Map<string, string>(); // old name -> resolved name
    const structsToAdd: Array<{
      name: string;
      fields: (typeof template.structs)[0]["fields"];
    }> = [];

    template.structs.forEach((struct) => {
      const existing = currentStructDefs.find((s) => s.name === struct.name);
      if (existing) {
        // Use existing struct, don't create duplicate
        structNameMap.set(struct.name, existing.name);
      } else {
        // Need to create new struct
        const newName = resolveStructName(struct.name);
        structNameMap.set(struct.name, newName);
        structsToAdd.push({ name: newName, fields: struct.fields });
      }
    });

    // Add only new structs
    structsToAdd.forEach((struct) => {
      // Update field types to use resolved struct names
      const updatedFields = struct.fields.map((field) => ({
        ...field,
        type: structNameMap.get(field.type) || field.type,
      }));

      addStructDefinition({
        name: struct.name,
        fields: updatedFields,
      });
    });

    // Create sample instances based on template type
    setTimeout(() => {
      const latestStructDefs = useCanvasStore.getState().structDefinitions;

      if (templateKey === "linkedList") {
        // Create 3 linked list nodes
        const finalStructName = structNameMap.get("Node")!;
        const struct = latestStructDefs.find((s) => s.name === finalStructName);
        if (!struct) return;

        addInstance(struct, { x: 100, y: 200 }, undefined);
        addInstance(struct, { x: 400, y: 200 }, undefined);
        addInstance(struct, { x: 700, y: 200 }, undefined);

        // Connect them after instances are created
        setTimeout(() => {
          const allInstances = useCanvasStore.getState().instances;
          const inst1 = allInstances[allInstances.length - 3];
          const inst2 = allInstances[allInstances.length - 2];
          const inst3 = allInstances[allInstances.length - 1];

          if (inst1 && inst2) {
            addConnection({
              sourceInstanceId: inst1.id,
              sourceFieldName: "next",
              targetInstanceId: inst2.id,
            });
          }
          if (inst2 && inst3) {
            addConnection({
              sourceInstanceId: inst2.id,
              sourceFieldName: "next",
              targetInstanceId: inst3.id,
            });
          }
        }, 100);
      } else if (templateKey === "tree") {
        // Create a small binary tree (root + 2 children)
        const finalStructName = structNameMap.get("TreeNode")!;
        const struct = latestStructDefs.find((s) => s.name === finalStructName);
        if (!struct) return;

        addInstance(struct, { x: 400, y: 100 }, undefined);
        addInstance(struct, { x: 200, y: 300 }, undefined);
        addInstance(struct, { x: 600, y: 300 }, undefined);

        setTimeout(() => {
          const allInstances = useCanvasStore.getState().instances;
          const rootInst = allInstances[allInstances.length - 3];
          const leftInst = allInstances[allInstances.length - 2];
          const rightInst = allInstances[allInstances.length - 1];

          if (rootInst && leftInst) {
            addConnection({
              sourceInstanceId: rootInst.id,
              sourceFieldName: "left",
              targetInstanceId: leftInst.id,
            });
          }
          if (rootInst && rightInst) {
            addConnection({
              sourceInstanceId: rootInst.id,
              sourceFieldName: "right",
              targetInstanceId: rightInst.id,
            });
          }
        }, 100);
      } else if (templateKey === "graph") {
        // Create 4 graph nodes with some connections
        const finalStructName = structNameMap.get("GraphNode")!;
        const struct = latestStructDefs.find((s) => s.name === finalStructName);
        if (!struct) return;

        addInstance(struct, { x: 200, y: 200 }, undefined);
        addInstance(struct, { x: 500, y: 200 }, undefined);
        addInstance(struct, { x: 200, y: 400 }, undefined);
        addInstance(struct, { x: 500, y: 400 }, undefined);

        setTimeout(() => {
          const allInstances = useCanvasStore.getState().instances;
          const inst1 = allInstances[allInstances.length - 4];
          const inst2 = allInstances[allInstances.length - 3];
          const inst3 = allInstances[allInstances.length - 2];
          const inst4 = allInstances[allInstances.length - 1];

          // Connect node1 to node2 and node3
          if (inst1 && inst2) {
            addConnection({
              sourceInstanceId: inst1.id,
              sourceFieldName: "neighbors[0]",
              targetInstanceId: inst2.id,
            });
          }
          if (inst1 && inst3) {
            addConnection({
              sourceInstanceId: inst1.id,
              sourceFieldName: "neighbors[1]",
              targetInstanceId: inst3.id,
            });
          }
          // Connect node2 to node4
          if (inst2 && inst4) {
            addConnection({
              sourceInstanceId: inst2.id,
              sourceFieldName: "neighbors[0]",
              targetInstanceId: inst4.id,
            });
          }
        }, 100);
      }
    }, 200);
  };

  return (
    <div className="fixed left-0 top-0 h-screen w-64 bg-white border-r-4 border-black z-20 flex flex-col">
      {/* Header */}
      <div
        className="p-4 border-b-4 border-black"
        style={{ backgroundColor: UI_COLORS.orange }}
      >
        <h2 className="text-xl font-heading tracking-wider uppercase">
          Structs
        </h2>
      </div>

      {/* Struct List */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Templates Section */}
        <div className="mb-4">
          <Button
            variant="neutral"
            size="sm"
            onClick={() => setShowTemplates(!showTemplates)}
            className="w-full flex items-center justify-between font-heading text-sm tracking-wide"
          >
            <span className="uppercase">Templates</span>
            {showTemplates ? (
              <ChevronUp size={16} strokeWidth={3} />
            ) : (
              <ChevronDown size={16} strokeWidth={3} />
            )}
          </Button>

          {showTemplates && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {Object.entries(templates).map(([key, template]) => {
                const Icon = template.icon;
                return (
                  <button
                    key={key}
                    onClick={() =>
                      handleLoadTemplate(key as keyof typeof templates)
                    }
                    className="border-2 border-black rounded-base p-2 flex flex-col items-center gap-1 transition shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
                    style={{ backgroundColor: UI_COLORS.cyan }}
                    title={`Load ${template.name}`}
                  >
                    <Icon size={18} strokeWidth={2.5} />
                    <span className="text-[10px] font-heading text-center leading-tight">
                      {template.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {structDefinitions.map((struct) => {
            const allStructNames = structDefinitions.map((s) => s.name);
            const structColor = getStructColor(struct.name, allStructNames);
            return (
              <div
                key={struct.name}
                draggable
                onDragStart={(e) => handleDragStart(e, struct.name)}
                onDoubleClick={() => onAddInstance(struct.name)}
                className="group border-2 border-black rounded-base p-2.5 cursor-move transition-all shadow-shadow hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2 relative"
                style={{ backgroundColor: structColor }}
              >
                {/* 6-dot drag indicator */}
                <div className="text-black flex-shrink-0">
                  <GripVertical size={18} strokeWidth={2.5} />
                </div>

                {/* Struct info */}
                <div className="flex-1 min-w-0">
                  <div className="font-mono font-heading text-xs truncate">
                    {struct.name}
                  </div>
                  <div className="text-xs font-base text-gray-700 mt-0.5">
                    {struct.fields.length} field
                    {struct.fields.length !== 1 ? "s" : ""}
                  </div>
                </div>

                {/* Action buttons on hover */}
                <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="noShadow"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditStruct(struct.name);
                    }}
                    className="size-7 p-0"
                    title="Edit"
                  >
                    <Edit2 size={12} strokeWidth={2.5} />
                  </Button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteStruct(struct.name);
                    }}
                    className="size-7 p-0 border-2 border-black rounded-base inline-flex items-center justify-center"
                    style={{ backgroundColor: UI_COLORS.redDelete }}
                    title="Delete"
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Create New Struct Button */}
          <Button
            onClick={onDefineStruct}
            className="w-full mt-3"
            style={{ backgroundColor: UI_COLORS.green }}
            title="Define New Struct"
          >
            <FileCode size={16} strokeWidth={2.5} />
            <span>New Struct</span>
          </Button>
        </div>

        {structDefinitions.length === 0 && (
          <div className="text-center text-gray-500 text-xs font-heading mt-8 mb-4">
            No structs defined
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-3 border-t-4 border-black space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleSaveWorkspace}
            size="sm"
            style={{ backgroundColor: UI_COLORS.blue }}
            title="Save Workspace"
          >
            <Save size={16} strokeWidth={2.5} />
            <span>Save</span>
          </Button>
          <Button
            onClick={handleLoadWorkspace}
            size="sm"
            style={{ backgroundColor: UI_COLORS.emerald }}
            title="Load Workspace"
          >
            <Upload size={16} strokeWidth={2.5} />
            <span>Load</span>
          </Button>
        </div>
        <Button
          onClick={onExport}
          className="w-full"
          style={{ backgroundColor: UI_COLORS.purple }}
          title="Export to PNG"
        >
          <Download size={16} strokeWidth={2.5} />
          <span>Export PNG</span>
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
