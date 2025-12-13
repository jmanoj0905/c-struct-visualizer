import { useCallback, useState, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Connection,
  type Edge,
  type Node,
  addEdge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  ConnectionMode,
  SelectionMode,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Plus,
  Sparkles,
  Trash2,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  MousePointer2,
  Move,
  Undo,
  Redo,
} from "lucide-react";
import { toPng } from "html-to-image";
import ELK from "elkjs/lib/elk.bundled.js";
import toast, { Toaster } from "react-hot-toast";

import StructNode from "./components/StructNode";
import StructEditor from "./components/StructEditor";
import CustomEdge from "./components/CustomEdge";
import Sidebar from "./components/Sidebar";
import Settings from "./components/Settings";
import { useCanvasStore } from "./store/canvasStore";
import { canConnectPointer, resolveTypeName } from "./parser/structParser";

const nodeTypes = {
  structNode: StructNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

function FlowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const {
    instances,
    structDefinitions,
    updateInstancePosition,
    addInstance,
    addConnection,
    removeConnection,
    removeInstance,
    connections,
    clearAll,
    undo,
    redo,
    saveHistory,
    history,
    historyIndex,
  } = useCanvasStore();

  const [showEditor, setShowEditor] = useState(false);
  const [editingStructName, setEditingStructName] = useState<
    string | undefined
  >(undefined);
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(() => {
    const saved = localStorage.getItem("snap-to-grid");
    return saved ? JSON.parse(saved) : true; // Default to true
  });
  const [copiedNodes, setCopiedNodes] = useState<string[]>([]);
  const [copiedConnections, setCopiedConnections] = useState<
    Array<{ sourceId: string; targetId: string; fieldName: string }>
  >([]);
  const [highlightedPath, setHighlightedPath] = useState<Set<string>>(
    new Set(),
  );
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    nodeId?: string;
  } | null>(null);
  const [quickAddMenu, setQuickAddMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    flowX: number;
    flowY: number;
  } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // Persist snap to grid to localStorage
  useEffect(() => {
    localStorage.setItem("snap-to-grid", JSON.stringify(snapToGrid));
  }, [snapToGrid]);
  const [connectionPopup, setConnectionPopup] = useState<{
    show: boolean;
    sourceInstanceId: string;
    sourceFieldName: string;
    pointerType: string;
    position: { x: number; y: number };
  } | null>(null);
  const [popupSearch, setPopupSearch] = useState("");

  const handleExportImage = useCallback(() => {
    const rfWrapper = reactFlowWrapper.current;
    if (!rfWrapper) return;

    const viewport = rfWrapper.querySelector(
      ".react-flow__viewport",
    ) as HTMLElement;
    if (!viewport) return;

    toPng(viewport, {
      backgroundColor: "#f3f4f6",
      filter: (node) => {
        // Exclude controls and other UI elements from export
        if (
          node?.classList?.contains("react-flow__controls") ||
          node?.classList?.contains("react-flow__minimap") ||
          node?.classList?.contains("react-flow__panel")
        ) {
          return false;
        }
        return true;
      },
    })
      .then((dataUrl) => {
        const link = document.createElement("a");
        link.download = `c-struct-diagram-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error("Failed to export image:", err);
        toast.error("Failed to export image. Please try again.");
      });
  }, []);

  // Convert instances to React Flow nodes
  const reactFlowNodes: Node[] = instances.map((instance) => {
    const structDef = structDefinitions.find(
      (s) => s.name === instance.structName,
    );

    const isHighlighted = highlightedPath.has(instance.id);

    return {
      id: instance.id,
      type: "structNode",
      position: instance.position,
      data: {
        instanceId: instance.id,
        structName: instance.structName,
        instanceName: instance.instanceName,
        fields: structDef?.fields || [],
        isHighlighted,
      },
      style: {
        opacity: highlightedPath.size > 0 && !isHighlighted ? 0.3 : 1,
      },
    };
  });

  // Calculate pointer path from a node (for highlighting)
  const calculatePointerPath = useCallback(
    (startNodeId: string): { nodeIds: Set<string>; hasCircular: boolean } => {
      const visited = new Set<string>();
      const path = new Set<string>();
      let hasCircular = false;

      const traverse = (nodeId: string, currentPath: Set<string>) => {
        if (currentPath.has(nodeId)) {
          hasCircular = true;
          return;
        }
        if (visited.has(nodeId)) {
          return;
        }

        visited.add(nodeId);
        path.add(nodeId);
        const newPath = new Set(currentPath);
        newPath.add(nodeId);

        // Find all outgoing connections from this node
        const outgoingConnections = connections.filter(
          (conn) => conn.sourceInstanceId === nodeId,
        );

        outgoingConnections.forEach((conn) => {
          path.add(conn.targetInstanceId);
          traverse(conn.targetInstanceId, newPath);
        });
      };

      traverse(startNodeId, new Set());
      return { nodeIds: path, hasCircular };
    },
    [connections],
  );

  // Convert connections to React Flow edges with smart routing
  const reactFlowEdges: Edge[] = connections.map((conn) => {
    // Calculate if we need vertical or horizontal offset based on node positions
    const sourceNode = instances.find((i) => i.id === conn.sourceInstanceId);
    const targetNode = instances.find((i) => i.id === conn.targetInstanceId);

    let offset = 50;
    if (sourceNode && targetNode) {
      // Increase offset if nodes are close vertically but far horizontally
      const deltaX = Math.abs(targetNode.position.x - sourceNode.position.x);
      const deltaY = Math.abs(targetNode.position.y - sourceNode.position.y);

      if (deltaY < 200 && deltaX > 300) {
        offset = 80; // More aggressive curve for horizontal connections
      } else if (deltaY > 300) {
        offset = 30; // Less curve for vertical connections
      }
    }

    // Check if this edge is part of highlighted path
    const isHighlighted =
      highlightedPath.size > 0 &&
      highlightedPath.has(conn.sourceInstanceId) &&
      highlightedPath.has(conn.targetInstanceId);

    return {
      id: conn.id,
      source: conn.sourceInstanceId,
      sourceHandle: `${conn.sourceInstanceId}-${conn.sourceFieldName}`,
      target: conn.targetInstanceId,
      targetHandle: `target-${conn.targetInstanceId}`,
      type: "custom",
      animated: isHighlighted,
      style: {
        stroke: isHighlighted ? "#3b82f6" : "#374151",
        strokeWidth: isHighlighted ? 3 : 2,
        cursor: "pointer",
        strokeDasharray: "0",
        opacity: highlightedPath.size > 0 && !isHighlighted ? 0.2 : 1,
      },
      markerEnd: {
        type: "arrowclosed" as const,
        color: isHighlighted ? "#3b82f6" : "#374151",
        width: 16,
        height: 16,
      },
      data: { connectionId: conn.id },
      pathOptions: { offset, borderRadius: 50 },
      zIndex: isHighlighted ? 2000 : 1000,
    };
  });

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Handle Shift key for selection mode toggle and Space for pan mode toggle
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key === "Shift" && !isSelecting) {
        setIsSelecting(true);
      }

      if (event.key === " " && isSelecting) {
        event.preventDefault(); // Prevent page scroll
        setIsSelecting(false);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift" && isSelecting) {
        setIsSelecting(false);
      }

      if (event.key === " " && !isSelecting) {
        event.preventDefault(); // Prevent page scroll
        setIsSelecting(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isSelecting]);

  // Handle keyboard shortcuts for bulk operations
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Undo (Ctrl+Z or Cmd+Z)
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "z" &&
        !event.shiftKey
      ) {
        event.preventDefault();
        undo();
        return;
      }

      // Redo (Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+U or Cmd+U)
      if (
        ((event.ctrlKey || event.metaKey) &&
          event.shiftKey &&
          event.key === "z") ||
        ((event.ctrlKey || event.metaKey) && event.key === "u")
      ) {
        event.preventDefault();
        redo();
        return;
      }

      // Delete key - remove selected nodes
      if (event.key === "Delete" || event.key === "Backspace") {
        const selectedNodes = nodes.filter((node) => node.selected);
        if (selectedNodes.length > 0) {
          event.preventDefault();

          toast(
            (t) => (
              <div className="flex flex-col gap-2">
                <p className="font-medium">
                  Delete {selectedNodes.length} selected node
                  {selectedNodes.length > 1 ? "s" : ""}?
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      toast.dismiss(t.id);
                    }}
                    className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      selectedNodes.forEach((node) => {
                        removeInstance(node.id);
                      });
                      toast.dismiss(t.id);
                      toast.success(
                        `Deleted ${selectedNodes.length} node${selectedNodes.length > 1 ? "s" : ""}`,
                      );
                    }}
                    className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ),
            {
              duration: 5000,
            },
          );
        }
      }

      // Copy nodes (Ctrl+C or Cmd+C)
      if ((event.ctrlKey || event.metaKey) && event.key === "c") {
        const selectedNodes = nodes.filter((node) => node.selected);
        if (selectedNodes.length > 0) {
          event.preventDefault();
          const selectedNodeIds = selectedNodes.map((node) => node.id);
          setCopiedNodes(selectedNodeIds);

          // Copy connections that are between selected nodes only
          const internalConnections = connections.filter(
            (conn) =>
              selectedNodeIds.includes(conn.sourceInstanceId) &&
              selectedNodeIds.includes(conn.targetInstanceId),
          );

          setCopiedConnections(
            internalConnections.map((conn) => ({
              sourceId: conn.sourceInstanceId,
              targetId: conn.targetInstanceId,
              fieldName: conn.sourceFieldName,
            })),
          );
        }
      }

      // Paste nodes (Ctrl+V or Cmd+V)
      if ((event.ctrlKey || event.metaKey) && event.key === "v") {
        if (copiedNodes.length > 0) {
          event.preventDefault();

          // Get the copied instances
          const instancesToCopy = instances.filter((inst) =>
            copiedNodes.includes(inst.id),
          );

          if (instancesToCopy.length > 0) {
            // Calculate offset for pasted nodes (shift them down and right)
            const offset = { x: 50, y: 50 };

            // Track number of instances before pasting
            const beforeCount = instances.length;

            // Create new instances at offset positions
            instancesToCopy.forEach((instance) => {
              const struct = structDefinitions.find(
                (s) => s.name === instance.structName,
              );
              if (struct) {
                const newPosition = {
                  x: instance.position.x + offset.x,
                  y: instance.position.y + offset.y,
                };
                addInstance(struct, newPosition, undefined);
              }
            });

            // Recreate connections and select pasted nodes
            setTimeout(() => {
              const allInstances = useCanvasStore.getState().instances;
              const newInstances = allInstances.slice(beforeCount);
              const newNodeIds = newInstances.map((inst) => inst.id);

              // Create mapping from old instance IDs to new instance IDs
              const idMap = new Map<string, string>();
              instancesToCopy.forEach((oldInst, index) => {
                if (newInstances[index]) {
                  idMap.set(oldInst.id, newInstances[index].id);
                }
              });

              // Recreate connections between pasted nodes
              copiedConnections.forEach((conn) => {
                const newSourceId = idMap.get(conn.sourceId);
                const newTargetId = idMap.get(conn.targetId);

                if (newSourceId && newTargetId) {
                  addConnection({
                    sourceInstanceId: newSourceId,
                    sourceFieldName: conn.fieldName,
                    targetInstanceId: newTargetId,
                  });
                }
              });

              // Select only the pasted nodes and deselect all others
              setTimeout(() => {
                setNodes((nds) =>
                  nds.map((node) => ({
                    ...node,
                    selected: newNodeIds.includes(node.id),
                  })),
                );
              }, 10);
            }, 50);
          }
        }
      }

      // Select all (Ctrl+A or Cmd+A)
      if ((event.ctrlKey || event.metaKey) && event.key === "a") {
        event.preventDefault();
        setNodes((nds) =>
          nds.map((node) => ({
            ...node,
            selected: true,
          })),
        );
        toast.success(`Selected all ${nodes.length} nodes`, { duration: 2000 });
        return;
      }

      // Escape key - clear path highlighting and deselect all nodes
      if (event.key === "Escape") {
        event.preventDefault();

        // Clear path highlighting if active
        if (highlightedPath.size > 0) {
          setHighlightedPath(new Set());
        }

        // Deselect all nodes
        const selectedCount = nodes.filter((n) => n.selected).length;
        if (selectedCount > 0) {
          setNodes((nds) =>
            nds.map((node) => ({
              ...node,
              selected: false,
            })),
          );
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    nodes,
    removeInstance,
    copiedNodes,
    instances,
    structDefinitions,
    addInstance,
    highlightedPath,
  ]);

  // Sync nodes and edges when store changes
  useEffect(() => {
    setNodes((currentNodes) => {
      // Preserve selection state from current nodes
      const selectionMap = new Map(
        currentNodes.map((n) => [n.id, n.selected || false]),
      );

      return reactFlowNodes.map((node) => ({
        ...node,
        selected: selectionMap.get(node.id) || false,
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instances, structDefinitions, highlightedPath]);

  useEffect(() => {
    setEdges(reactFlowEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections, instances, highlightedPath]); // Re-calculate edges when instances move or path changes

  // Sync positions when nodes are dragged
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node, allNodes: Node[]) => {
      // If the dragged node is selected, update all selected nodes
      if (node.selected) {
        const selectedNodes = allNodes.filter((n) => n.selected);
        selectedNodes.forEach((n) => {
          updateInstancePosition(n.id, n.position);
        });
      } else {
        // Only update the single node that was dragged
        updateInstancePosition(node.id, node.position);
      }
      // Save history after drag is complete
      saveHistory();
    },
    [updateInstancePosition, saveHistory],
  );

  // Handle node click for path highlighting
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Toggle path highlighting
      if (highlightedPath.has(node.id) && highlightedPath.size === 1) {
        // If clicking the same node that's already highlighted, clear the highlight
        setHighlightedPath(new Set());
      } else {
        // Calculate and highlight the path from this node
        const { nodeIds, hasCircular } = calculatePointerPath(node.id);
        setHighlightedPath(nodeIds);

        // Show toast if circular reference detected
        if (hasCircular) {
          setTimeout(() => {
            toast.error(
              "Circular reference detected! This pointer path contains a circular reference where a node points back to itself or a previous node in the chain.",
              { duration: 4000 },
            );
          }, 100);
        }
      }
    },
    [highlightedPath, calculatePointerPath],
  );

  // Handle node context menu (right-click)
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({
        show: true,
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
      });
    },
    [],
  );

  // Handle canvas context menu (right-click on empty area)
  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      setContextMenu({
        show: true,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [],
  );

  // Handle double-click on canvas for quick add menu
  const handlePaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      setQuickAddMenu({
        show: true,
        x: event.clientX,
        y: event.clientY,
        flowX: position.x,
        flowY: position.y,
      });
    },
    [screenToFlowPosition],
  );

  // Handle click on empty canvas to clear highlights and deselect all
  const handlePaneClick = useCallback(() => {
    if (highlightedPath.size > 0) {
      setHighlightedPath(new Set());
    }

    // Deselect all nodes
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        selected: false,
      })),
    );
  }, [highlightedPath, setNodes]);

  // Handle new pointer connections with type validation and smart targeting
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (
        !connection.source ||
        !connection.target ||
        !connection.sourceHandle
      ) {
        return;
      }

      // Extract field name from handle ID (format: instanceId-fieldName or instanceId-fieldName[index])
      const fieldName = connection.sourceHandle.split("-").pop() || "";

      // Extract base field name (for array fields like "p[0]", extract "p")
      const baseFieldName = fieldName.split("[")[0];

      // Get source instance and field info
      const sourceInstance = instances.find((i) => i.id === connection.source);
      const sourceStruct = structDefinitions.find(
        (s) => s.name === sourceInstance?.structName,
      );
      const sourceField = sourceStruct?.fields.find(
        (f) => f.name === baseFieldName,
      );

      if (!sourceField || !sourceField.isPointer) {
        toast.error("Only pointer fields can create connections!");
        return;
      }

      // Get target instance
      const targetInstance = instances.find((i) => i.id === connection.target);

      if (!targetInstance) {
        return;
      }

      // Type validation - resolve typedef names to struct names
      const resolvedPointerType = resolveTypeName(
        sourceField.type,
        structDefinitions,
      );
      const resolvedTargetType = resolveTypeName(
        targetInstance.structName,
        structDefinitions,
      );

      if (!canConnectPointer(resolvedPointerType, resolvedTargetType)) {
        toast.error(
          `Type mismatch! ${sourceField.type}* cannot point to struct ${targetInstance.structName}. Make sure pointer types match the target struct.`,
          { duration: 4000 },
        );
        return;
      }

      // IMPORTANT: Check if this pointer already has a connection
      const existingConnection = connections.find(
        (conn) =>
          conn.sourceInstanceId === connection.source &&
          conn.sourceFieldName === fieldName,
      );

      if (existingConnection) {
        toast.error(
          `This pointer is already connected! A pointer can only have one connection. Remove the existing connection first (right-click on the arrow).`,
          { duration: 4000 },
        );
        return;
      }

      // SMART CONNECTION: If user dropped on the main target handle (not a specific field handle),
      // try to find the first compatible pointer target field in the target struct
      if (connection.targetHandle === `target-${connection.target}`) {
        // Get target struct definition
        const targetStruct = structDefinitions.find(
          (s) => s.name === targetInstance.structName,
        );

        if (targetStruct) {
          // Find first field that matches the pointer type (pointer targets are on the left side)
          // These would be any field that this pointer can point to - essentially all fields
          // since we're pointing to the struct itself
          const firstMatchingField = targetStruct.fields[0]; // First field is good enough

          if (firstMatchingField) {
            // Auto-connect to the target handle (left side purple handle)
            // The connection is to the struct instance itself, not to a specific field
            addConnection({
              sourceInstanceId: connection.source,
              sourceFieldName: fieldName,
              targetInstanceId: connection.target,
            });

            setEdges((eds) => addEdge(connection, eds));
            return;
          }
        }

        // If no matching field found, fall through to show popup
        // This shouldn't normally happen since we already validated the type
        // But if it does, we show the popup
        return;
      }

      // Regular connection to a specific handle
      addConnection({
        sourceInstanceId: connection.source,
        sourceFieldName: fieldName,
        targetInstanceId: connection.target,
      });

      setEdges((eds) => addEdge(connection, eds));
    },
    [instances, structDefinitions, addConnection, setEdges, connections],
  );

  // Handle edge click for deletion (left-click)
  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      toast(
        (t) => (
          <div className="flex flex-col gap-2">
            <p className="font-medium">Remove this pointer connection?</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => toast.dismiss(t.id)}
                className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (edge.data?.connectionId) {
                    removeConnection(edge.data.connectionId as string);
                    toast.dismiss(t.id);
                    toast.success("Connection removed");
                  }
                }}
                className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition"
              >
                Remove
              </button>
            </div>
          </div>
        ),
        { duration: 5000 },
      );
    },
    [removeConnection],
  );

  // Handle edge context menu (right-click) for deletion
  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault(); // Prevent default context menu
      if (edge.data?.connectionId) {
        removeConnection(edge.data.connectionId as string);
        // Also remove from React Flow's edge state
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      }
    },
    [removeConnection, setEdges],
  );

  // Validate connections - allow source (pointer) to target (struct) connections
  const isValidConnection = useCallback(
    (connection: Edge | Connection): boolean => {
      // Must have source and target
      if (
        !connection.source ||
        !connection.target ||
        !connection.sourceHandle
      ) {
        return false;
      }

      // Allow connections from source handles to target handles
      return (
        connection.sourceHandle.includes("-") &&
        (connection.targetHandle?.startsWith("target-") ?? false)
      );
    },
    [],
  );

  // Handle connection end (when user releases without connecting)
  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: unknown) => {
      // Type guard for connection state
      if (!connectionState || typeof connectionState !== "object") return;
      const state = connectionState as {
        fromHandle?: { nodeId?: string; id?: string; type?: string };
        toHandle?: unknown;
      };
      // Only show popup if dragged to open area (not connecting to another node)
      if (
        !state.fromHandle ||
        state.fromHandle.type !== "source" ||
        state.toHandle // If toHandle exists, user is connecting to a node
      ) {
        return;
      }

      const sourceInstanceId = state.fromHandle.nodeId;
      const sourceHandleId = state.fromHandle.id;

      if (!sourceHandleId || !sourceInstanceId) return;

      // Extract field name from handle ID (format: instanceId-fieldName or instanceId-fieldName[index])
      const fieldName = sourceHandleId.split("-").pop() || "";

      // Extract base field name (for array fields like "p[0]", extract "p")
      const baseFieldName = fieldName.split("[")[0];

      // Get the source field info
      const sourceInstance = instances.find((i) => i.id === sourceInstanceId);
      const sourceStruct = structDefinitions.find(
        (s) => s.name === sourceInstance?.structName,
      );
      const sourceField = sourceStruct?.fields.find(
        (f) => f.name === baseFieldName,
      );

      if (!sourceField || !sourceField.isPointer) return;

      // Get mouse position
      const mouseEvent = event as MouseEvent;
      const position = {
        x: mouseEvent.clientX,
        y: mouseEvent.clientY,
      };

      // Show connection popup and reset search
      setConnectionPopup({
        show: true,
        sourceInstanceId,
        sourceFieldName: fieldName,
        pointerType: sourceField.type,
        position,
      });
      setPopupSearch(""); // Reset search when popup opens
    },
    [instances, structDefinitions],
  );

  // Auto-layout using ELK.js algorithm with support for orphaned nodes
  const handleCleanupLayout = useCallback(async () => {
    if (instances.length === 0) return;

    const elk = new ELK();

    // Separate connected nodes from orphaned nodes
    const connectedNodeIds = new Set<string>();
    connections.forEach((conn) => {
      connectedNodeIds.add(conn.sourceInstanceId);
      connectedNodeIds.add(conn.targetInstanceId);
    });

    const connectedInstances = instances.filter((inst) =>
      connectedNodeIds.has(inst.id),
    );
    const orphanedInstances = instances.filter(
      (inst) => !connectedNodeIds.has(inst.id),
    );

    try {
      let maxY = 100;

      // Layout connected nodes if any exist
      if (connectedInstances.length > 0 && connections.length > 0) {
        // Helper to get field order for priority calculation
        const getFieldIndex = (
          instanceId: string,
          fieldName: string,
        ): number => {
          const instance = instances.find((i) => i.id === instanceId);
          if (!instance) return 0;

          const struct = structDefinitions.find(
            (s) => s.name === instance.structName,
          );
          if (!struct) return 0;

          // Extract base field name (handle array notation like "id[0]")
          const baseFieldName = fieldName.split("[")[0];

          // Find field index in struct definition
          const fieldIndex = struct.fields.findIndex(
            (f) => f.name === baseFieldName,
          );

          // For array fields, add the array index to maintain order
          if (fieldName.includes("[")) {
            const arrayIndex = parseInt(
              fieldName.match(/\[(\d+)\]/)?.[1] || "0",
              10,
            );
            return fieldIndex * 1000 + arrayIndex; // Scale to preserve both field and array order
          }

          return fieldIndex * 1000;
        };

        const elkGraph = {
          id: "root",
          layoutOptions: {
            "elk.algorithm": "layered",
            "elk.direction": "RIGHT",
            "elk.spacing.nodeNode": "150", // Much larger spacing to prevent overlap
            "elk.layered.spacing.nodeNodeBetweenLayers": "300", // Increased spacing between layers
            "elk.padding": "[80,80,80,80]", // Increased padding
            "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
            "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
            "elk.considerModelOrder.strategy": "PREFER_EDGES",
            "elk.spacing.edgeNode": "100", // Increased edge to node spacing
            "elk.spacing.edgeEdge": "50", // Increased edge to edge spacing
            "elk.layered.spacing.edgeNodeBetweenLayers": "100", // Increased spacing
            "elk.layered.spacing.baseValue": "120", // Base spacing value
            "elk.separateConnectedComponents": "true", // Separate disconnected components
          },
          children: connectedInstances.map((instance) => {
            // Calculate height based on number of fields for more accurate layout
            const struct = structDefinitions.find(
              (s) => s.name === instance.structName,
            );
            const fieldCount = struct?.fields.length || 0;
            const baseHeight = 100; // Header + padding
            const fieldHeight = 80; // Approximate height per field (increased for new design)
            const calculatedHeight = baseHeight + fieldCount * fieldHeight;

            return {
              id: instance.id,
              width: 350, // Increased width for new card design
              height: Math.max(250, calculatedHeight),
            };
          }),
          edges: connections.map((conn, index) => {
            // Calculate priority based on source field order
            // Lower field index = higher priority (appears higher)
            const fieldOrder = getFieldIndex(
              conn.sourceInstanceId,
              conn.sourceFieldName,
            );

            return {
              id: `edge-${index}`,
              sources: [conn.sourceInstanceId],
              targets: [conn.targetInstanceId],
              layoutOptions: {
                "elk.priority": String(fieldOrder),
              },
            };
          }),
        };

        const layout = await elk.layout(elkGraph);

        // Apply calculated positions for connected nodes
        layout.children?.forEach((node) => {
          if (node.x !== undefined && node.y !== undefined) {
            updateInstancePosition(node.id, {
              x: node.x,
              y: node.y,
            });
            // Track max Y for orphaned nodes placement - use actual node height
            const nodeHeight = node.height || 200;
            maxY = Math.max(maxY, node.y + nodeHeight);
          }
        });
      }

      // Layout orphaned nodes below in a grid with increased spacing
      if (orphanedInstances.length > 0) {
        const orphanStartY = maxY + 300; // Increased spacing between flows (was 150)
        const orphanStartX = 100;
        const spacing = 400; // Increased horizontal spacing (was 350)
        const rowSpacing = 350; // Increased vertical spacing (was 280)
        const nodesPerRow = 3;

        orphanedInstances.forEach((instance, index) => {
          const row = Math.floor(index / nodesPerRow);
          const col = index % nodesPerRow;

          // Calculate height for better spacing
          const struct = structDefinitions.find(
            (s) => s.name === instance.structName,
          );
          const fieldCount = struct?.fields.length || 0;
          const baseHeight = 80;
          const fieldHeight = 60;
          const calculatedHeight = baseHeight + fieldCount * fieldHeight;
          const nodeHeight = Math.max(200, calculatedHeight);

          updateInstancePosition(instance.id, {
            x: orphanStartX + col * spacing,
            y: orphanStartY + row * (rowSpacing + (nodeHeight - 200)),
          });
        });
      }
    } catch (error) {
      console.error("ELK layout error:", error);
    }
  }, [instances, connections, updateInstancePosition]);

  // Handle drag and drop from sidebar
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const structName = event.dataTransfer.getData("application/reactflow");
      if (!structName) return;

      const struct = structDefinitions.find((s) => s.name === structName);
      if (!struct) return;

      // Convert screen coordinates to flow coordinates (accounts for zoom/pan)
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Snap to grid
      position.x = Math.round(position.x / 20) * 20;
      position.y = Math.round(position.y / 20) * 20;

      addInstance(struct, position, undefined);
    },
    [structDefinitions, addInstance, screenToFlowPosition],
  );

  // Handle double-click from sidebar to add instance at center
  const handleAddInstanceFromSidebar = useCallback(
    (structName: string) => {
      const struct = structDefinitions.find((s) => s.name === structName);
      if (!struct) return;

      // Add at center of viewport
      const position = {
        x: 400,
        y: 300,
      };

      addInstance(struct, position, undefined);
    },
    [structDefinitions, addInstance],
  );

  return (
    <div ref={reactFlowWrapper} className="w-screen h-screen bg-gray-50">
      <Toaster position="top-right" />
      {/* Sidebar Toggle Button - On the edge of sidebar */}
      <button
        onClick={() => setShowSidebar(!showSidebar)}
        className={`fixed top-1/2 -translate-y-1/2 z-30 bg-[#80DEEA] py-4 px-2 border-4 border-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none ${
          showSidebar ? "left-64 rounded-r-none" : "left-0 rounded-r-none"
        }`}
        title={showSidebar ? "Hide Sidebar" : "Show Sidebar"}
      >
        {showSidebar ? (
          <ChevronLeft size={20} strokeWidth={3} />
        ) : (
          <ChevronRight size={20} strokeWidth={3} />
        )}
      </button>

      {/* Sidebar */}
      {showSidebar && (
        <Sidebar
          onEditStruct={(structName) => {
            setEditingStructName(structName);
            setShowEditor(true);
          }}
          onExport={handleExportImage}
          onAddInstance={handleAddInstanceFromSidebar}
          onDefineStruct={() => {
            setEditingStructName(undefined);
            setShowEditor(true);
          }}
        />
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onConnectEnd={handleConnectEnd}
        onNodeDragStop={handleNodeDragStop}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeClick={handleEdgeClick}
        onEdgeContextMenu={handleEdgeContextMenu}
        onPaneContextMenu={handlePaneContextMenu}
        onPaneClick={handlePaneClick}
        onDoubleClick={handlePaneDoubleClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        isValidConnection={isValidConnection}
        fitView
        className={`bg-gray-50 ${showSidebar ? "ml-64" : "ml-0"}`}
        elevateEdgesOnSelect={true}
        snapToGrid={snapToGrid}
        snapGrid={[20, 20]}
        defaultEdgeOptions={{
          type: "custom",
        }}
        connectionMode={ConnectionMode.Loose}
        selectionMode={SelectionMode.Partial}
        panOnDrag={isSelecting ? false : [1, 2]}
        selectionOnDrag={isSelecting}
        zoomOnDoubleClick={false}
        nodesConnectable={true}
        nodesDraggable={true}
        elementsSelectable={true}
      >
        <Background
          variant={BackgroundVariant.Lines}
          gap={20}
          size={1}
          color="#d1d5db"
        />
        <Controls />

        {/* Selection Mode Toggle and Undo/Redo */}
        <Panel position="bottom-left" className="flex gap-3">
          <button
            onClick={() => setIsSelecting(!isSelecting)}
            className={`p-3 rounded-none border-4 border-black transition shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 ${
              isSelecting ? "bg-[#B39DDB]" : "bg-[#FFF59D]"
            }`}
            title={
              isSelecting
                ? "Switch to Pan Mode (Shift)"
                : "Switch to Selection Mode (Shift)"
            }
          >
            {isSelecting ? (
              <MousePointer2 size={22} strokeWidth={2.5} />
            ) : (
              <Move size={22} strokeWidth={2.5} />
            )}
          </button>

          <button
            onClick={() => {
              undo();
              toast.success("Undo", { duration: 1000 });
            }}
            disabled={historyIndex <= 0 || !history || history.length === 0}
            className={`p-3 rounded-none border-4 border-black transition shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${
              historyIndex <= 0 || !history || history.length === 0
                ? "bg-gray-300 text-gray-500 cursor-not-allowed shadow-none"
                : "bg-[#A5D6A7] active:shadow-none active:translate-x-1 active:translate-y-1"
            }`}
            title="Undo (Ctrl/Cmd+Z)"
          >
            <Undo size={22} strokeWidth={2.5} />
          </button>

          <button
            onClick={() => {
              redo();
              toast.success("Redo", { duration: 1000 });
            }}
            disabled={
              !history ||
              history.length === 0 ||
              historyIndex >= history.length - 1
            }
            className={`p-3 rounded-none border-4 border-black transition shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${
              !history ||
              history.length === 0 ||
              historyIndex >= history.length - 1
                ? "bg-gray-300 text-gray-500 cursor-not-allowed shadow-none"
                : "bg-[#FFCC80] active:shadow-none active:translate-x-1 active:translate-y-1"
            }`}
            title="Redo (Ctrl/Cmd+Shift+Z or Ctrl/Cmd+U)"
          >
            <Redo size={22} strokeWidth={2.5} />
          </button>
        </Panel>
      </ReactFlow>

      {/* Top-right buttons */}
      <div className="fixed top-4 right-4 flex gap-3 z-10">
        {/* Settings button */}
        <button
          onClick={() => setShowSettings(true)}
          className="bg-[#DDA0DD] p-3 rounded-none border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition active:shadow-none active:translate-x-1 active:translate-y-1"
          title="Settings"
        >
          <SettingsIcon size={22} strokeWidth={2.5} />
        </button>

        {/* Clear All button */}
        <button
          onClick={() => {
            toast(
              (t) => (
                <div className="flex flex-col gap-3">
                  <p className="font-bold text-base">Clear workspace?</p>
                  <p className="text-sm">
                    This will remove all instances and connections
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => toast.dismiss(t.id)}
                      className="px-4 py-2 text-sm font-bold bg-gray-200 hover:bg-gray-300 rounded-none border-3 border-black transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        clearAll();
                        toast.dismiss(t.id);
                        toast.success("Workspace cleared");
                      }}
                      className="px-4 py-2 text-sm font-bold bg-red-400 hover:bg-red-500 rounded-none border-3 border-black transition"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ),
              { duration: 5000 },
            );
          }}
          className="bg-[#EF9A9A] p-3 rounded-none border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition active:shadow-none active:translate-x-1 active:translate-y-1"
          title="Clear All"
        >
          <Trash2 size={22} strokeWidth={2.5} />
        </button>
      </div>

      {/* Bottom-right buttons */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-10">
        {/* Cleanup layout button */}
        <button
          onClick={handleCleanupLayout}
          className="bg-gray-900 hover:bg-black text-white p-3 rounded-lg shadow-lg transition"
          title="Clean up layout"
        >
          <Sparkles size={16} />
        </button>
      </div>

      {showEditor && (
        <StructEditor
          onClose={() => {
            setShowEditor(false);
            setEditingStructName(undefined);
          }}
          editStructName={editingStructName}
        />
      )}

      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          snapToGrid={snapToGrid}
          onSnapToGridChange={setSnapToGrid}
        />
      )}

      {/* Connection popup for quick node creation */}
      {connectionPopup && (
        <>
          {/* Backdrop to close popup */}
          <div
            className="fixed inset-0 z-20"
            onClick={() => setConnectionPopup(null)}
          />

          {/* Popup menu */}
          <div
            className="fixed z-30 bg-white rounded-lg shadow-xl border border-gray-300 p-3 min-w-[250px]"
            style={{
              left: connectionPopup.position.x,
              top: connectionPopup.position.y,
            }}
          >
            <div className="text-xs font-mono text-gray-500 px-2 py-1 border-b border-gray-200 mb-2">
              {connectionPopup.pointerType}*
            </div>

            {/* Search input */}
            <input
              type="text"
              value={popupSearch}
              onChange={(e) => setPopupSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  // Get the filtered and sorted structs (only compatible types)
                  const filteredStructs = structDefinitions
                    .slice()
                    .filter((struct) => {
                      // ONLY show compatible types
                      const isCompatible =
                        connectionPopup.pointerType === "void" ||
                        struct.name === connectionPopup.pointerType;

                      if (!isCompatible) return false;

                      if (popupSearch.trim() === "") return true;
                      return struct.name
                        .toLowerCase()
                        .includes(popupSearch.toLowerCase());
                    })
                    .sort((a, b) => {
                      const aMatches =
                        connectionPopup.pointerType === "void" ||
                        a.name === connectionPopup.pointerType;
                      const bMatches =
                        connectionPopup.pointerType === "void" ||
                        b.name === connectionPopup.pointerType;
                      if (aMatches && !bMatches) return -1;
                      if (!aMatches && bMatches) return 1;
                      return 0;
                    });

                  // Select the first one
                  if (filteredStructs.length > 0) {
                    const topStruct = filteredStructs[0];
                    const sourceInstance = instances.find(
                      (i) => i.id === connectionPopup.sourceInstanceId,
                    );
                    const newPosition = {
                      x: (sourceInstance?.position.x || 0) + 350,
                      y: sourceInstance?.position.y || 0,
                    };

                    addInstance(topStruct, newPosition, undefined);

                    setTimeout(() => {
                      const updatedInstances =
                        useCanvasStore.getState().instances;
                      const newInstance =
                        updatedInstances[updatedInstances.length - 1];
                      if (newInstance) {
                        addConnection({
                          sourceInstanceId: connectionPopup.sourceInstanceId,
                          sourceFieldName: connectionPopup.sourceFieldName,
                          targetInstanceId: newInstance.id,
                        });
                      }
                      setConnectionPopup(null);
                    }, 50);
                  }
                }
              }}
              placeholder="Search..."
              autoFocus
              className="w-full px-3 py-1.5 text-xs font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 mb-2"
            />

            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {structDefinitions
                .slice() // Create a copy to avoid mutating original
                .filter((struct) => {
                  // ONLY show compatible types: void* can point to anything, otherwise must match exactly
                  const isCompatible =
                    connectionPopup.pointerType === "void" ||
                    struct.name === connectionPopup.pointerType;

                  if (!isCompatible) return false;

                  // Filter by search term
                  if (popupSearch.trim() === "") return true;
                  return struct.name
                    .toLowerCase()
                    .includes(popupSearch.toLowerCase());
                })
                .sort((a, b) => {
                  // Sort: exact type matches first, then maintain sidebar order
                  const aMatches =
                    connectionPopup.pointerType === "void" ||
                    a.name === connectionPopup.pointerType;
                  const bMatches =
                    connectionPopup.pointerType === "void" ||
                    b.name === connectionPopup.pointerType;

                  if (aMatches && !bMatches) return -1; // a comes first
                  if (!aMatches && bMatches) return 1; // b comes first
                  return 0; // Keep original sidebar order for same category
                })
                .map((struct) => {
                  const isExactMatch =
                    connectionPopup.pointerType === "void" ||
                    struct.name === connectionPopup.pointerType;

                  return (
                    <button
                      key={struct.name}
                      onClick={() => {
                        // Create new instance at a position near the source
                        const sourceInstance = instances.find(
                          (i) => i.id === connectionPopup.sourceInstanceId,
                        );
                        const newPosition = {
                          x: (sourceInstance?.position.x || 0) + 350,
                          y: sourceInstance?.position.y || 0,
                        };

                        // Create the instance with auto-naming (no prompt)
                        addInstance(struct, newPosition, undefined);

                        // Get the new instance ID (it will be the last one added)
                        setTimeout(() => {
                          const updatedInstances =
                            useCanvasStore.getState().instances;
                          const newInstance =
                            updatedInstances[updatedInstances.length - 1];
                          if (newInstance) {
                            // Create the connection
                            addConnection({
                              sourceInstanceId:
                                connectionPopup.sourceInstanceId,
                              sourceFieldName: connectionPopup.sourceFieldName,
                              targetInstanceId: newInstance.id,
                            });
                          }
                          setConnectionPopup(null);
                        }, 50);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 text-xs font-mono hover:bg-gray-100 rounded-md transition flex items-center gap-2 ${
                        isExactMatch ? "bg-gray-50 border border-gray-300" : ""
                      }`}
                    >
                      <Plus
                        size={12}
                        className={
                          isExactMatch ? "text-gray-700" : "text-gray-500"
                        }
                      />
                      <span
                        className={
                          isExactMatch
                            ? "font-medium text-gray-800"
                            : "text-gray-600"
                        }
                      >
                        {struct.name}
                      </span>
                    </button>
                  );
                })}

              {/* Option to cancel */}
              <div className="border-t border-gray-200 mt-1.5 pt-1.5">
                <button
                  onClick={() => setConnectionPopup(null)}
                  className="w-full text-center px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 rounded-md transition font-mono"
                >
                  esc
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-20"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />

          {/* Menu */}
          <div
            className="fixed z-30 bg-white rounded-lg shadow-xl border border-gray-300 py-1 min-w-[160px]"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
            }}
          >
            {contextMenu.nodeId ? (
              // Node context menu
              <>
                <button
                  onClick={() => {
                    if (contextMenu.nodeId) {
                      const node = instances.find(
                        (i) => i.id === contextMenu.nodeId,
                      );
                      if (node) {
                        const { nodeIds, hasCircular } = calculatePointerPath(
                          contextMenu.nodeId,
                        );
                        setHighlightedPath(nodeIds);
                        if (hasCircular) {
                          toast.error("Circular reference detected!", {
                            duration: 3000,
                          });
                        }
                      }
                    }
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 transition"
                >
                  Highlight Path
                </button>
                <button
                  onClick={() => {
                    setCopiedNodes([contextMenu.nodeId!]);
                    setContextMenu(null);
                    toast.success("Node copied", { duration: 2000 });
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 transition"
                >
                  Copy Node
                </button>
                <button
                  onClick={() => {
                    const instance = instances.find(
                      (i) => i.id === contextMenu.nodeId,
                    );
                    if (instance) {
                      const struct = structDefinitions.find(
                        (s) => s.name === instance.structName,
                      );
                      if (struct) {
                        // Create duplicate at offset position
                        addInstance(
                          struct,
                          {
                            x: instance.position.x + 50,
                            y: instance.position.y + 50,
                          },
                          undefined,
                        );
                        toast.success("Node duplicated", { duration: 2000 });
                      }
                    }
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 transition"
                >
                  Duplicate Node
                </button>
                <div className="border-t border-gray-200 my-1" />
                <button
                  onClick={() => {
                    const nodeId = contextMenu.nodeId!;
                    setContextMenu(null);

                    toast(
                      (t) => (
                        <div className="flex flex-col gap-2">
                          <p className="font-medium">
                            Delete this node and all its connections?
                          </p>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => toast.dismiss(t.id)}
                              className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded transition"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                removeInstance(nodeId);
                                toast.dismiss(t.id);
                                toast.success("Node deleted");
                              }}
                              className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ),
                      { duration: 5000 },
                    );
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition"
                >
                  Delete Node
                </button>
              </>
            ) : (
              // Canvas context menu
              <>
                <button
                  onClick={() => {
                    if (copiedNodes.length > 0) {
                      const instancesToCopy = instances.filter((inst) =>
                        copiedNodes.includes(inst.id),
                      );
                      instancesToCopy.forEach((instance) => {
                        const struct = structDefinitions.find(
                          (s) => s.name === instance.structName,
                        );
                        if (struct) {
                          const newPosition = {
                            x: instance.position.x + 50,
                            y: instance.position.y + 50,
                          };
                          addInstance(struct, newPosition, undefined);
                        }
                      });
                    }
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={copiedNodes.length === 0}
                >
                  Paste Node{copiedNodes.length > 1 ? "s" : ""}
                </button>
                <button
                  onClick={() => {
                    setHighlightedPath(new Set());
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={highlightedPath.size === 0}
                >
                  Clear Highlights
                </button>
                <div className="border-t border-gray-200 my-1" />
                <button
                  onClick={() => {
                    handleCleanupLayout();
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 transition"
                >
                  Auto Layout
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Quick Add Menu */}
      {quickAddMenu && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-20"
            onClick={() => setQuickAddMenu(null)}
          />

          {/* Menu */}
          <div
            className="fixed z-30 bg-white rounded-lg shadow-xl border border-gray-300 p-3 min-w-[200px]"
            style={{
              left: quickAddMenu.x,
              top: quickAddMenu.y,
            }}
          >
            <div className="text-xs font-medium text-gray-500 mb-2">
              Add Node
            </div>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {structDefinitions.map((struct) => (
                <button
                  key={struct.name}
                  onClick={() => {
                    const position = {
                      x: Math.round(quickAddMenu.flowX / 20) * 20,
                      y: Math.round(quickAddMenu.flowY / 20) * 20,
                    };
                    addInstance(struct, position, undefined);
                    setQuickAddMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-mono hover:bg-gray-100 rounded-md transition"
                >
                  {struct.name}
                </button>
              ))}

              {structDefinitions.length === 0 && (
                <div className="text-center text-gray-400 text-xs py-4">
                  No structs defined
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 mt-2 pt-2">
              <button
                onClick={() => {
                  setQuickAddMenu(null);
                  setEditingStructName(undefined);
                  setShowEditor(true);
                }}
                className="w-full bg-gray-800 hover:bg-gray-900 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition"
              >
                <Plus size={12} />
                <span>New Struct</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function App() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}

export default App;
