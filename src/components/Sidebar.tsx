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
  FileImage,
  FileType,
  Copy,
  Box,
  Layers,
  Users,
  Database,
} from "lucide-react";
import { useState } from "react";
import { useCanvasStore } from "../store/canvasStore";
import type { CStruct } from "../types";
import { getStructColor, UI_COLORS } from "../utils/colors";
import { Button } from "./ui/button";
import { showAlert } from "./AlertContainer";

interface SidebarProps {
  onEditStruct: (structName: string) => void;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onExportPDF: () => void;
  onCopyToClipboard: () => void;
  onAddInstance: (structName: string) => void;
  onDefineStruct: () => void;
}

// Template data structures
const templates = {
  singlyLinkedList: {
    name: "Singly Linked List",
    icon: List,
    structs: [
      {
        name: "Node",
        typedef: "Node_t",
        fields: [
          { name: "data", type: "int", isPointer: false, isArray: false },
          { name: "next", type: "Node", isPointer: true, isArray: false },
        ],
      },
    ] as CStruct[],
  },
  doublyLinkedList: {
    name: "Doubly Linked List",
    icon: List,
    structs: [
      {
        name: "DNode",
        typedef: "DNode_t",
        fields: [
          { name: "data", type: "int", isPointer: false, isArray: false },
          { name: "next", type: "DNode", isPointer: true, isArray: false },
          { name: "prev", type: "DNode", isPointer: true, isArray: false },
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
        typedef: "TreeNode_t",
        fields: [
          { name: "value", type: "int", isPointer: false, isArray: false },
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
        typedef: "GraphNode_t",
        fields: [
          { name: "id", type: "int", isPointer: false, isArray: false },
          {
            name: "edges",
            type: "GraphNode",
            isPointer: true,
            isArray: true,
            arraySize: 5,
          },
          { name: "edgeCount", type: "int", isPointer: false, isArray: false },
        ],
      },
    ] as CStruct[],
  },
  stack: {
    name: "Stack",
    icon: Layers,
    structs: [
      {
        name: "StackNode",
        typedef: "StackNode_t",
        fields: [
          { name: "data", type: "int", isPointer: false, isArray: false },
          { name: "next", type: "StackNode", isPointer: true, isArray: false },
        ],
      },
    ] as CStruct[],
  },
  queue: {
    name: "Queue",
    icon: List,
    structs: [
      {
        name: "QueueNode",
        typedef: "QueueNode_t",
        fields: [
          { name: "data", type: "int", isPointer: false, isArray: false },
          { name: "next", type: "QueueNode", isPointer: true, isArray: false },
        ],
      },
    ] as CStruct[],
  },
  circularList: {
    name: "Circular List",
    icon: Network,
    structs: [
      {
        name: "CircNode",
        typedef: "CircNode_t",
        fields: [
          { name: "data", type: "int", isPointer: false, isArray: false },
          { name: "next", type: "CircNode", isPointer: true, isArray: false },
        ],
      },
    ] as CStruct[],
  },
  bst: {
    name: "BST",
    icon: GitBranch,
    structs: [
      {
        name: "BSTNode",
        typedef: "BSTNode_t",
        fields: [
          { name: "key", type: "int", isPointer: false, isArray: false },
          { name: "left", type: "BSTNode", isPointer: true, isArray: false },
          { name: "right", type: "BSTNode", isPointer: true, isArray: false },
          { name: "parent", type: "BSTNode", isPointer: true, isArray: false },
        ],
      },
    ] as CStruct[],
  },
};

const Sidebar = ({
  onEditStruct,
  onExportPNG,
  onExportSVG,
  onExportPDF,
  onCopyToClipboard,
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
    instances,
  } = useCanvasStore();

  const [showTemplates, setShowTemplates] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleDragStart = (event: React.DragEvent, structName: string) => {
    event.dataTransfer.setData("application/reactflow", structName);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDeleteStruct = (structName: string) => {
    // Count instances of this struct
    const instanceCount = instances.filter(
      (inst) => inst.structName === structName,
    ).length;

    let confirmMessage = "";
    if (instanceCount > 0) {
      confirmMessage = `Warning: There ${instanceCount === 1 ? "is" : "are"} ${instanceCount} instance${instanceCount === 1 ? "" : "s"} of "${structName}" in the workspace.\n\nDeleting this struct will also remove all ${instanceCount} instance${instanceCount === 1 ? "" : "s"} from the workspace.\n\nAre you sure you want to delete?`;
    } else {
      confirmMessage = `Are you sure you want to delete struct "${structName}"?`;
    }

    showAlert({
      type: "confirm",
      message: confirmMessage,
      onConfirm: () => {
        deleteStructDefinition(structName);
        showAlert({
          type: "success",
          message: `Struct "${structName}" deleted`,
          duration: 2000,
        });
      },
      confirmText: "Delete",
      cancelText: "Cancel",
    });
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

    showAlert({
      type: "info",
      message: `Loading ${template.name} template...`,
      duration: 1500,
    });

    // Add struct definitions if they don't exist
    template.structs.forEach((templateStruct) => {
      const currentStructDefs = useCanvasStore.getState().structDefinitions;
      const existing = currentStructDefs.find(
        (s) => s.name === templateStruct.name,
      );

      if (!existing) {
        addStructDefinition({
          name: templateStruct.name,
          typedef: templateStruct.typedef,
          fields: templateStruct.fields,
        });
      }
    });

    // Create sample instances based on template type
    setTimeout(() => {
      const latestStructDefs = useCanvasStore.getState().structDefinitions;
      const { updateFieldValue } = useCanvasStore.getState();

      if (templateKey === "singlyLinkedList") {
        // Create 3 linked list nodes
        const struct = latestStructDefs.find((s) => s.name === "Node");
        if (!struct) return;

        addInstance(struct, { x: 100, y: 200 }, "head");
        addInstance(struct, { x: 400, y: 200 }, "node_2");
        addInstance(struct, { x: 700, y: 200 }, "node_3");

        // Set field values and connect
        setTimeout(() => {
          const allInstances = useCanvasStore.getState().instances;
          const inst1 = allInstances[allInstances.length - 3];
          const inst2 = allInstances[allInstances.length - 2];
          const inst3 = allInstances[allInstances.length - 1];

          if (inst1) updateFieldValue(inst1.id, "data", 10);
          if (inst2) updateFieldValue(inst2.id, "data", 20);
          if (inst3) updateFieldValue(inst3.id, "data", 30);

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
      } else if (templateKey === "doublyLinkedList") {
        // Create 3 doubly linked list nodes in horizontal line
        const struct = latestStructDefs.find((s) => s.name === "DNode");
        if (!struct) return;

        addInstance(struct, { x: 100, y: 250 }, "node_1");
        addInstance(struct, { x: 400, y: 250 }, "node_2");
        addInstance(struct, { x: 700, y: 250 }, "node_3");

        // Set field values and connect bidirectionally
        setTimeout(() => {
          const allInstances = useCanvasStore.getState().instances;
          const inst1 = allInstances[allInstances.length - 3];
          const inst2 = allInstances[allInstances.length - 2];
          const inst3 = allInstances[allInstances.length - 1];

          if (inst1) updateFieldValue(inst1.id, "data", 5);
          if (inst2) updateFieldValue(inst2.id, "data", 10);
          if (inst3) updateFieldValue(inst3.id, "data", 15);

          if (inst1 && inst2) {
            addConnection({
              sourceInstanceId: inst1.id,
              sourceFieldName: "next",
              targetInstanceId: inst2.id,
            });
            addConnection({
              sourceInstanceId: inst2.id,
              sourceFieldName: "prev",
              targetInstanceId: inst1.id,
            });
          }
          if (inst2 && inst3) {
            addConnection({
              sourceInstanceId: inst2.id,
              sourceFieldName: "next",
              targetInstanceId: inst3.id,
            });
            addConnection({
              sourceInstanceId: inst3.id,
              sourceFieldName: "prev",
              targetInstanceId: inst2.id,
            });
          }
        }, 100);
      } else if (templateKey === "tree") {
        // Create a small binary tree (root + 2 children)
        const struct = latestStructDefs.find((s) => s.name === "TreeNode");
        if (!struct) return;

        addInstance(struct, { x: 400, y: 100 }, "root");
        addInstance(struct, { x: 200, y: 300 }, "left_child");
        addInstance(struct, { x: 600, y: 300 }, "right_child");

        setTimeout(() => {
          const allInstances = useCanvasStore.getState().instances;
          const rootInst = allInstances[allInstances.length - 3];
          const leftInst = allInstances[allInstances.length - 2];
          const rightInst = allInstances[allInstances.length - 1];

          if (rootInst) updateFieldValue(rootInst.id, "value", 50);
          if (leftInst) updateFieldValue(leftInst.id, "value", 30);
          if (rightInst) updateFieldValue(rightInst.id, "value", 70);

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
        const struct = latestStructDefs.find((s) => s.name === "GraphNode");
        if (!struct) return;

        addInstance(struct, { x: 200, y: 200 }, "node_A");
        addInstance(struct, { x: 500, y: 200 }, "node_B");
        addInstance(struct, { x: 200, y: 400 }, "node_C");
        addInstance(struct, { x: 500, y: 400 }, "node_D");

        setTimeout(() => {
          const allInstances = useCanvasStore.getState().instances;
          const inst1 = allInstances[allInstances.length - 4];
          const inst2 = allInstances[allInstances.length - 3];
          const inst3 = allInstances[allInstances.length - 2];
          const inst4 = allInstances[allInstances.length - 1];

          if (inst1) {
            updateFieldValue(inst1.id, "id", 1);
            updateFieldValue(inst1.id, "edgeCount", 2);
          }
          if (inst2) {
            updateFieldValue(inst2.id, "id", 2);
            updateFieldValue(inst2.id, "edgeCount", 1);
          }
          if (inst3) {
            updateFieldValue(inst3.id, "id", 3);
            updateFieldValue(inst3.id, "edgeCount", 0);
          }
          if (inst4) {
            updateFieldValue(inst4.id, "id", 4);
            updateFieldValue(inst4.id, "edgeCount", 0);
          }

          // Connect node1 to node2 and node3
          if (inst1 && inst2) {
            addConnection({
              sourceInstanceId: inst1.id,
              sourceFieldName: "edges[0]",
              targetInstanceId: inst2.id,
            });
          }
          if (inst1 && inst3) {
            addConnection({
              sourceInstanceId: inst1.id,
              sourceFieldName: "edges[1]",
              targetInstanceId: inst3.id,
            });
          }
          // Connect node2 to node4
          if (inst2 && inst4) {
            addConnection({
              sourceInstanceId: inst2.id,
              sourceFieldName: "edges[0]",
              targetInstanceId: inst4.id,
            });
          }
        }, 100);
      } else if (templateKey === "stack") {
        // Create 3 nodes in a vertical stack
        const struct = latestStructDefs.find((s) => s.name === "StackNode");
        if (!struct) return;

        addInstance(struct, { x: 300, y: 100 }, "top");
        addInstance(struct, { x: 300, y: 250 }, "middle");
        addInstance(struct, { x: 300, y: 400 }, "bottom");

        setTimeout(() => {
          const allInstances = useCanvasStore.getState().instances;
          const inst1 = allInstances[allInstances.length - 3];
          const inst2 = allInstances[allInstances.length - 2];
          const inst3 = allInstances[allInstances.length - 1];

          if (inst1) updateFieldValue(inst1.id, "data", 100);
          if (inst2) updateFieldValue(inst2.id, "data", 200);
          if (inst3) updateFieldValue(inst3.id, "data", 300);

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
      } else if (templateKey === "queue") {
        // Create 3 nodes in a horizontal queue
        const struct = latestStructDefs.find((s) => s.name === "QueueNode");
        if (!struct) return;

        addInstance(struct, { x: 100, y: 250 }, "front");
        addInstance(struct, { x: 400, y: 250 }, "middle");
        addInstance(struct, { x: 700, y: 250 }, "rear");

        setTimeout(() => {
          const allInstances = useCanvasStore.getState().instances;
          const inst1 = allInstances[allInstances.length - 3];
          const inst2 = allInstances[allInstances.length - 2];
          const inst3 = allInstances[allInstances.length - 1];

          if (inst1) updateFieldValue(inst1.id, "data", 1);
          if (inst2) updateFieldValue(inst2.id, "data", 2);
          if (inst3) updateFieldValue(inst3.id, "data", 3);

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
      } else if (templateKey === "circularList") {
        // Create 4 nodes in a circle
        const struct = latestStructDefs.find((s) => s.name === "CircNode");
        if (!struct) return;

        addInstance(struct, { x: 300, y: 100 }, "node_1");
        addInstance(struct, { x: 500, y: 200 }, "node_2");
        addInstance(struct, { x: 300, y: 400 }, "node_3");
        addInstance(struct, { x: 100, y: 200 }, "node_4");

        setTimeout(() => {
          const allInstances = useCanvasStore.getState().instances;
          const inst1 = allInstances[allInstances.length - 4];
          const inst2 = allInstances[allInstances.length - 3];
          const inst3 = allInstances[allInstances.length - 2];
          const inst4 = allInstances[allInstances.length - 1];

          if (inst1) updateFieldValue(inst1.id, "data", 10);
          if (inst2) updateFieldValue(inst2.id, "data", 20);
          if (inst3) updateFieldValue(inst3.id, "data", 30);
          if (inst4) updateFieldValue(inst4.id, "data", 40);

          // Create circular connections
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
          if (inst3 && inst4) {
            addConnection({
              sourceInstanceId: inst3.id,
              sourceFieldName: "next",
              targetInstanceId: inst4.id,
            });
          }
          if (inst4 && inst1) {
            addConnection({
              sourceInstanceId: inst4.id,
              sourceFieldName: "next",
              targetInstanceId: inst1.id,
            });
          }
        }, 100);
      } else if (templateKey === "bst") {
        // Create a BST with root and children with parent pointers
        const struct = latestStructDefs.find((s) => s.name === "BSTNode");
        if (!struct) return;

        addInstance(struct, { x: 400, y: 100 }, "root");
        addInstance(struct, { x: 200, y: 300 }, "left");
        addInstance(struct, { x: 600, y: 300 }, "right");

        setTimeout(() => {
          const allInstances = useCanvasStore.getState().instances;
          const rootInst = allInstances[allInstances.length - 3];
          const leftInst = allInstances[allInstances.length - 2];
          const rightInst = allInstances[allInstances.length - 1];

          if (rootInst) updateFieldValue(rootInst.id, "key", 50);
          if (leftInst) updateFieldValue(leftInst.id, "key", 25);
          if (rightInst) updateFieldValue(rightInst.id, "key", 75);

          if (rootInst && leftInst) {
            addConnection({
              sourceInstanceId: rootInst.id,
              sourceFieldName: "left",
              targetInstanceId: leftInst.id,
            });
            addConnection({
              sourceInstanceId: leftInst.id,
              sourceFieldName: "parent",
              targetInstanceId: rootInst.id,
            });
          }
          if (rootInst && rightInst) {
            addConnection({
              sourceInstanceId: rootInst.id,
              sourceFieldName: "right",
              targetInstanceId: rightInst.id,
            });
            addConnection({
              sourceInstanceId: rightInst.id,
              sourceFieldName: "parent",
              targetInstanceId: rootInst.id,
            });
          }
        }, 100);
      }
    }, 200);
  };

  return (
    <div className="h-screen w-64 bg-white border-r-4 border-black flex flex-col">
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

      {/* Action Buttons at Bottom */}
      <div className="p-3 border-t-4 border-black space-y-2">
        {/* Templates Section */}
        <div>
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

        {/* Save/Export and Load buttons */}
        <div className="grid grid-cols-2 gap-2">
          {/* Save/Export combined dropdown */}
          <div className="relative">
            <Button
              onClick={() => setShowExportMenu(!showExportMenu)}
              size="sm"
              style={{ backgroundColor: UI_COLORS.blue }}
              title="Save & Export"
              className="w-full"
            >
              <Save size={16} strokeWidth={2.5} />
              <span>Save</span>
              {showExportMenu ? (
                <ChevronUp size={14} strokeWidth={2.5} />
              ) : (
                <ChevronDown size={14} strokeWidth={2.5} />
              )}
            </Button>

            {showExportMenu && (
              <div className="absolute bottom-full mb-2 left-0 right-0 space-y-1 border-2 border-black rounded-base p-2 bg-white dropdown-menu">
                <button
                  onClick={() => {
                    handleSaveWorkspace();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm font-heading rounded-base hover:bg-gray-100 border-2 border-transparent hover:border-black transition-all flex items-center gap-2"
                  title="Save workspace as JSON"
                >
                  <Save size={16} strokeWidth={2.5} />
                  <span>Save JSON</span>
                </button>
                <button
                  onClick={() => {
                    onExportPNG();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm font-heading rounded-base hover:bg-gray-100 border-2 border-transparent hover:border-black transition-all flex items-center gap-2"
                  title="Export as PNG image"
                >
                  <FileImage size={16} strokeWidth={2.5} />
                  <span>PNG Image</span>
                </button>
                <button
                  onClick={() => {
                    onExportSVG();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm font-heading rounded-base hover:bg-gray-100 border-2 border-transparent hover:border-black transition-all flex items-center gap-2"
                  title="Export as SVG (scalable vector)"
                >
                  <FileType size={16} strokeWidth={2.5} />
                  <span>SVG Vector</span>
                </button>
                <button
                  onClick={() => {
                    onExportPDF();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm font-heading rounded-base hover:bg-gray-100 border-2 border-transparent hover:border-black transition-all flex items-center gap-2"
                  title="Export as PDF document"
                >
                  <FileCode size={16} strokeWidth={2.5} />
                  <span>PDF Document</span>
                </button>
                <button
                  onClick={() => {
                    onCopyToClipboard();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm font-heading rounded-base hover:bg-gray-100 border-2 border-transparent hover:border-black transition-all flex items-center gap-2"
                  title="Copy image to clipboard"
                >
                  <Copy size={16} strokeWidth={2.5} />
                  <span>Copy to Clipboard</span>
                </button>
              </div>
            )}
          </div>

          {/* Load button */}
          <Button
            onClick={handleLoadWorkspace}
            size="sm"
            style={{ backgroundColor: UI_COLORS.pink }}
            title="Load Workspace"
          >
            <Upload size={16} strokeWidth={2.5} />
            <span>Load</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
