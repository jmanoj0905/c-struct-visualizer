import { useCallback, useState, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toPng, toSvg } from "html-to-image";
import jsPDF from "jspdf";
import AlertContainer, { showAlert } from "./components/AlertContainer";

import StructNode from "./components/StructNode";
import PointerNode from "./components/PointerNode";
import StructEditor from "./components/StructEditor";
import Sidebar from "./components/Sidebar";
import WorkspaceTabBar from "./components/WorkspaceTabBar";
import PointerMenu from "./components/PointerMenu";
import Settings from "./components/Settings";
import Dock from "./components/Dock";
import CommandPalette from "./components/CommandPalette";
import TemplateManager from "./components/TemplateManager";
import CodeVisualizerLayout from "./components/visualizer/CodeVisualizerLayout";
import WelcomeScreen from "./components/WelcomeScreen";
import HowToUseGuide from "./components/HowToUseGuide";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { useCanvasStore } from "./store/canvasStore";
import { canConnectPointer, canConnectPointerToPointer, canConnectPointerToField, isPrimitiveType, resolveTypeName } from "./parser/structParser";
import { UI_COLORS } from "./utils/colors";
import { performSmartLayout } from "./utils/smartLayout";
import type { PointerInstance } from "./types";

const nodeTypes = {
  structNode: StructNode,
  pointerNode: PointerNode,
};

// Edge types removed - using default smoothstep for all connections

function FlowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const {
    instances,
    structDefinitions,
    updateInstancePosition,
    addInstance,
    addConnection,
    removeConnection,
    removeInstance,
    removeInstances,
    connections,
    clearAll,
    undo,
    redo,
    saveHistory,
    history,
    historyIndex,
    pointerInstances,
    pointerDefinitions,
    addPointerInstance,
    updatePointerInstancePosition,
    updatePointerInstanceTarget,
    removePointerInstance,
    removePointerInstances,
    activeWorkspaceId,
    workspaceTabs,
  } = useCanvasStore();

  const [showEditor, setShowEditor] = useState(false);
  const [editingStructName, setEditingStructName] = useState<
    string | undefined
  >(undefined);
  const [showSettings, setShowSettings] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showHowToUse, setShowHowToUse] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showPointerMenu, setShowPointerMenu] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(() => {
    const saved = localStorage.getItem("snap-to-grid");
    return saved ? JSON.parse(saved) : true; // Default to true
  });
  const [clipboard, setClipboard] = useState<{
    nodeIds: string[];
    structConnections: Array<{
      sourceId: string;
      targetId: string;
      fieldName: string;
      targetFieldName: string | null;
    }>;
    pointerTargets: Array<{
      pointerId: string;
      targetId: string;
      targetFieldName: string | null;
    }>;
  } | null>(null);
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

  // Fit view when workspace tab changes
  useEffect(() => {
    setTimeout(() => fitView({ padding: 0.3, duration: 300, maxZoom: 0.9 }), 100);
  }, [activeWorkspaceId, fitView]);
  const [connectionPopup, setConnectionPopup] = useState<{
    show: boolean;
    sourceInstanceId: string;
    sourceFieldName: string;
    pointerType: string;
    position: { x: number; y: number };
    flowPosition?: { x: number; y: number };
  } | null>(null);
  const [popupSearch, setPopupSearch] = useState("");

  const getViewportElement = useCallback(() => {
    const rfWrapper = reactFlowWrapper.current;
    if (!rfWrapper) return null;
    return rfWrapper.querySelector(".react-flow__viewport") as HTMLElement;
  }, []);

  const exportFilter = (node: HTMLElement) => {
    // Exclude controls and other UI elements from export
    if (
      node?.classList?.contains("react-flow__controls") ||
      node?.classList?.contains("react-flow__minimap") ||
      node?.classList?.contains("react-flow__panel")
    ) {
      return false;
    }
    return true;
  };

  const handleExportPNG = useCallback(() => {
    const viewport = getViewportElement();
    if (!viewport) return;

    toPng(viewport, {
      backgroundColor: "#f3f4f6",
      filter: exportFilter,
    })
      .then((dataUrl) => {
        const link = document.createElement("a");
        link.download = `c-struct-diagram-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        showAlert({
          type: "success",
          message: "PNG exported successfully!",
          duration: 2000,
        });
      })
      .catch((err) => {
        console.error("Failed to export PNG:", err);
        showAlert({
          type: "error",
          message: "Failed to export PNG. Please try again.",
        });
      });
  }, [getViewportElement]);

  const handleExportSVG = useCallback(() => {
    const viewport = getViewportElement();
    if (!viewport) return;

    toSvg(viewport, {
      backgroundColor: "#f3f4f6",
      filter: exportFilter,
    })
      .then((dataUrl) => {
        const link = document.createElement("a");
        link.download = `c-struct-diagram-${Date.now()}.svg`;
        link.href = dataUrl;
        link.click();
        showAlert({
          type: "success",
          message: "SVG exported successfully!",
          duration: 2000,
        });
      })
      .catch((err) => {
        console.error("Failed to export SVG:", err);
        showAlert({
          type: "error",
          message: "Failed to export SVG. Please try again.",
        });
      });
  }, [getViewportElement]);

  const handleExportPDF = useCallback(() => {
    const viewport = getViewportElement();
    if (!viewport) return;

    toPng(viewport, {
      backgroundColor: "#f3f4f6",
      filter: exportFilter,
      pixelRatio: 2, // Higher quality for PDF
    })
      .then((dataUrl) => {
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => {
          const pdf = new jsPDF({
            orientation: img.width > img.height ? "landscape" : "portrait",
            unit: "px",
            format: [img.width, img.height],
          });
          pdf.addImage(dataUrl, "PNG", 0, 0, img.width, img.height);
          pdf.save(`c-struct-diagram-${Date.now()}.pdf`);
          showAlert({
            type: "success",
            message: "PDF exported successfully!",
            duration: 2000,
          });
        };
      })
      .catch((err) => {
        console.error("Failed to export PDF:", err);
        showAlert({
          type: "error",
          message: "Failed to export PDF. Please try again.",
        });
      });
  }, [getViewportElement]);

  const handleCopyToClipboard = useCallback(() => {
    const viewport = getViewportElement();
    if (!viewport) return;

    toPng(viewport, {
      backgroundColor: "#f3f4f6",
      filter: exportFilter,
    })
      .then((dataUrl) => {
        // Convert data URL to blob
        fetch(dataUrl)
          .then((res) => res.blob())
          .then((blob) => {
            // Copy to clipboard
            navigator.clipboard
              .write([
                new ClipboardItem({
                  [blob.type]: blob,
                }),
              ])
              .then(() => {
                showAlert({
                  type: "success",
                  message: "Copied to clipboard!",
                  duration: 2000,
                });
              })
              .catch((err) => {
                console.error("Failed to copy to clipboard:", err);
                showAlert({
                  type: "error",
                  message:
                    "Failed to copy to clipboard. Your browser may not support this feature.",
                  duration: 3000,
                });
              });
          });
      })
      .catch((err) => {
        console.error("Failed to copy to clipboard:", err);
        showAlert({
          type: "error",
          message: "Failed to copy to clipboard. Please try again.",
        });
      });
  }, [getViewportElement]);

  // Save workspace to JSON file
  const handleSaveWorkspace = useCallback(() => {
    const data = useCanvasStore.getState().exportWorkspace();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `c-struct-workspace-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showAlert({
      type: "success",
      message: "Workspace saved successfully",
      duration: 2000,
    });
  }, []);

  // Load workspace from JSON file
  const handleLoadWorkspace = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const data = event.target?.result as string;
          useCanvasStore.getState().importWorkspace(data);
          showAlert({
            type: "success",
            message: "Workspace loaded successfully",
            duration: 2000,
          });
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, []);

  // Heap export helpers for visualizer mode
  const getHeapViewport = useCallback(() => {
    const heapCanvas = document.getElementById("heap-canvas");
    if (!heapCanvas) return null;
    return heapCanvas.querySelector(".react-flow__viewport") as HTMLElement | null;
  }, []);

  const handleHeapExportPNG = useCallback(() => {
    const viewport = getHeapViewport();
    if (!viewport) return;
    toPng(viewport, { backgroundColor: "#f3f4f6", filter: exportFilter })
      .then((dataUrl) => {
        const link = document.createElement("a");
        link.download = `heap-diagram-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        showAlert({ type: "success", message: "PNG exported successfully!", duration: 2000 });
      })
      .catch(() => showAlert({ type: "error", message: "Failed to export PNG. Please try again." }));
  }, [getHeapViewport]);

  const handleHeapExportSVG = useCallback(() => {
    const viewport = getHeapViewport();
    if (!viewport) return;
    toSvg(viewport, { backgroundColor: "#f3f4f6", filter: exportFilter })
      .then((dataUrl) => {
        const link = document.createElement("a");
        link.download = `heap-diagram-${Date.now()}.svg`;
        link.href = dataUrl;
        link.click();
        showAlert({ type: "success", message: "SVG exported successfully!", duration: 2000 });
      })
      .catch(() => showAlert({ type: "error", message: "Failed to export SVG. Please try again." }));
  }, [getHeapViewport]);

  const handleHeapExportPDF = useCallback(() => {
    const viewport = getHeapViewport();
    if (!viewport) return;
    toPng(viewport, { backgroundColor: "#f3f4f6", filter: exportFilter, pixelRatio: 2 })
      .then((dataUrl) => {
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => {
          const pdf = new jsPDF({
            orientation: img.width > img.height ? "landscape" : "portrait",
            unit: "px",
            format: [img.width, img.height],
          });
          pdf.addImage(dataUrl, "PNG", 0, 0, img.width, img.height);
          pdf.save(`heap-diagram-${Date.now()}.pdf`);
          showAlert({ type: "success", message: "PDF exported successfully!", duration: 2000 });
        };
      })
      .catch(() => showAlert({ type: "error", message: "Failed to export PDF. Please try again." }));
  }, [getHeapViewport]);

  const handleHeapCopyToClipboard = useCallback(() => {
    const viewport = getHeapViewport();
    if (!viewport) return;
    toPng(viewport, { backgroundColor: "#f3f4f6", filter: exportFilter })
      .then((dataUrl) =>
        fetch(dataUrl)
          .then((res) => res.blob())
          .then((blob) =>
            navigator.clipboard
              .write([new ClipboardItem({ [blob.type]: blob })])
              .then(() => showAlert({ type: "success", message: "Copied to clipboard!", duration: 2000 }))
              .catch(() => showAlert({ type: "error", message: "Failed to copy to clipboard.", duration: 3000 }))
          )
      )
      .catch(() => showAlert({ type: "error", message: "Failed to copy to clipboard. Please try again." }));
  }, [getHeapViewport]);

  // Convert instances to React Flow nodes
  const structNodes: Node[] = instances.map((instance) => {
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

  // Convert pointer instances to React Flow nodes
  const pointerNodes: Node[] = pointerInstances.map((pi) => {
    const isHighlighted = highlightedPath.has(pi.id);
    return {
      id: pi.id,
      type: "pointerNode",
      position: pi.position,
      data: {
        pointerInstanceId: pi.id,
        name: pi.name,
        type: pi.type,
        pointerLevel: pi.pointerLevel,
        targetInstanceId: pi.targetInstanceId,
        targetFieldName: pi.targetFieldName,
        color: pi.color,
      },
      style: {
        opacity: highlightedPath.size > 0 && !isHighlighted ? 0.3 : 1,
      },
    };
  });

  const reactFlowNodes: Node[] = [...structNodes, ...pointerNodes];

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

        // Find all outgoing struct connections from this node
        const outgoingConnections = connections.filter(
          (conn) => conn.sourceInstanceId === nodeId,
        );

        outgoingConnections.forEach((conn) => {
          path.add(conn.targetInstanceId);
          traverse(conn.targetInstanceId, newPath);
        });

        // Also follow pointer instance connections
        const outgoingPointers = pointerInstances.filter(
          (pi) => pi.id === nodeId && pi.targetInstanceId,
        );
        outgoingPointers.forEach((pi) => {
          if (pi.targetInstanceId) {
            path.add(pi.targetInstanceId);
            traverse(pi.targetInstanceId, newPath);
          }
        });
      };

      traverse(startNodeId, new Set());
      return { nodeIds: path, hasCircular };
    },
    [connections, pointerInstances],
  );

  // Convert connections to React Flow edges
  const structEdges: Edge[] = connections.map((conn) => {
    // Check if this edge is part of highlighted path
    const isHighlighted =
      highlightedPath.size > 0 &&
      highlightedPath.has(conn.sourceInstanceId) &&
      highlightedPath.has(conn.targetInstanceId);

    // Determine target handle: field-level or struct-level
    const targetHandle = conn.targetFieldName
      ? `field-target-${conn.targetInstanceId}-${conn.targetFieldName}`
      : `target-left-${conn.targetInstanceId}`;

    return {
      id: conn.id,
      source: conn.sourceInstanceId,
      sourceHandle: `${conn.sourceInstanceId}-${conn.sourceFieldName}`,
      target: conn.targetInstanceId,
      targetHandle,
      type: "smoothstep",
      animated: isHighlighted,
      style: {
        stroke: isHighlighted ? "#3b82f6" : "#374151",
        strokeWidth: isHighlighted ? 4 : 3,
        cursor: "pointer",
        strokeDasharray: "6 3",
        opacity: highlightedPath.size > 0 && !isHighlighted ? 0.2 : 1,
      },
      markerEnd: {
        type: "arrowclosed" as const,
        color: isHighlighted ? "#3b82f6" : "#374151",
        width: 16,
        height: 16,
      },
      data: { connectionId: conn.id },
      zIndex: isHighlighted ? 2000 : 1000,
    };
  });

  // Convert pointer instance connections to React Flow edges
  const pointerEdges: Edge[] = pointerInstances
    .filter((pi) => pi.targetInstanceId)
    .map((pi) => {
      const isHighlighted =
        highlightedPath.size > 0 &&
        highlightedPath.has(pi.id) &&
        highlightedPath.has(pi.targetInstanceId!);

      // Determine target handle: pointer-target if target is a pointer, field-target if field, target-left if struct
      const targetIsPointer = pointerInstances.some(
        (p) => p.id === pi.targetInstanceId,
      );
      const targetHandle = targetIsPointer
        ? `pointer-target-${pi.targetInstanceId}`
        : pi.targetFieldName
          ? `field-target-${pi.targetInstanceId}-${pi.targetFieldName}`
          : `target-left-${pi.targetInstanceId}`;

      return {
        id: `ptr-edge-${pi.id}`,
        source: pi.id,
        sourceHandle: `pointer-source-${pi.id}`,
        target: pi.targetInstanceId!,
        targetHandle,
        type: "smoothstep",
        animated: isHighlighted,
        style: {
          stroke: isHighlighted ? "#3b82f6" : "#374151",
          strokeWidth: isHighlighted ? 4 : 3,
          strokeDasharray: "6 3",
          cursor: "pointer",
          opacity: highlightedPath.size > 0 && !isHighlighted ? 0.2 : 1,
        },
        markerEnd: {
          type: "arrowclosed" as const,
          color: isHighlighted ? "#3b82f6" : "#374151",
          width: 16,
          height: 16,
        },
        data: { pointerInstanceId: pi.id },
        zIndex: isHighlighted ? 2000 : 1000,
      };
    });

  const reactFlowEdges: Edge[] = [...structEdges, ...pointerEdges];

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Handle Shift key for selection mode toggle and ESC to cancel operations
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input or if struct editor is open
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        showEditor
      ) {
        return;
      }

      if (event.key === "Shift" && !isSelecting) {
        setIsSelecting(true);
      }

      // ESC to cancel operations
      if (event.key === "Escape") {
        // Close connection popup
        if (connectionPopup) {
          setConnectionPopup(null);
          showAlert({
            type: "success",
            message: "Connection cancelled",
            duration: 1500,
          });
        }
        // Close context menu
        if (contextMenu) {
          setContextMenu(null);
        }
        // Close quick add menu
        if (quickAddMenu) {
          setQuickAddMenu(null);
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      // Ignore if struct editor is open
      if (showEditor) {
        return;
      }

      if (event.key === "Shift" && isSelecting) {
        setIsSelecting(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isSelecting, showEditor, connectionPopup, contextMenu, quickAddMenu]);

  // Handle keyboard shortcuts for bulk operations
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input or if struct editor is open
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        showEditor
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

          showAlert({
            type: "confirm",
            message: `Delete ${selectedNodes.length} selected node${selectedNodes.length > 1 ? "s" : ""}?`,
            onConfirm: () => {
              const structNodeIds = selectedNodes
                .filter((n) => n.type !== "pointerNode")
                .map((n) => n.id);
              const pointerNodeIds = selectedNodes
                .filter((n) => n.type === "pointerNode")
                .map((n) => n.id);

              if (structNodeIds.length > 0) {
                removeInstances(structNodeIds);
              }
              if (pointerNodeIds.length > 0) {
                removePointerInstances(pointerNodeIds);
              }
              showAlert({
                type: "success",
                message: `Deleted ${selectedNodes.length} node${selectedNodes.length > 1 ? "s" : ""}`,
                duration: 2000,
              });
            },
            confirmText: "Delete",
            cancelText: "Cancel",
          });
        }
      }

      // Helper: snapshot the clipboard from a set of selected node IDs
      const snapshotClipboard = (selectedNodeIds: string[]) => {
        // Struct connections where source is in selection
        const structConns = connections
          .filter((conn) => selectedNodeIds.includes(conn.sourceInstanceId))
          .map((conn) => ({
            sourceId: conn.sourceInstanceId,
            targetId: conn.targetInstanceId,
            fieldName: conn.sourceFieldName,
            targetFieldName: conn.targetFieldName ?? null,
          }));

        // Pointer targets where the pointer is in selection
        const ptrTargets = pointerInstances
          .filter((pi) => selectedNodeIds.includes(pi.id) && pi.targetInstanceId)
          .map((pi) => ({
            pointerId: pi.id,
            targetId: pi.targetInstanceId!,
            targetFieldName: pi.targetFieldName,
          }));

        return { nodeIds: selectedNodeIds, structConnections: structConns, pointerTargets: ptrTargets };
      };

      // Helper: paste from a clipboard snapshot, returns new node IDs
      const pasteFromClipboard = (clip: NonNullable<typeof clipboard>, offset: { x: number; y: number }) => {
        const idMap = new Map<string, string>();
        const allNewNodeIds: string[] = [];

        // Clone struct instances
        clip.nodeIds.forEach((nodeId) => {
          const instance = instances.find((i) => i.id === nodeId);
          if (instance) {
            const struct = structDefinitions.find((s) => s.name === instance.structName);
            if (struct) {
              const newInstance = addInstance(struct, {
                x: instance.position.x + offset.x,
                y: instance.position.y + offset.y,
              }, undefined);
              if (newInstance) {
                idMap.set(nodeId, newInstance.id);
                allNewNodeIds.push(newInstance.id);
              }
            }
          }
        });

        // Clone pointer instances
        clip.nodeIds.forEach((nodeId) => {
          const ptrInst = pointerInstances.find((pi) => pi.id === nodeId);
          if (ptrInst) {
            const newId = `ptrinst-${Date.now()}-${Math.random()}`;
            addPointerInstance({
              ...ptrInst,
              id: newId,
              position: {
                x: ptrInst.position.x + offset.x,
                y: ptrInst.position.y + offset.y,
              },
              targetInstanceId: null,
              targetFieldName: null,
            });
            idMap.set(nodeId, newId);
            allNewNodeIds.push(newId);
          }
        });

        // Reconnect after nodes are created
        setTimeout(() => {
          // Struct connections: remap source (always copied), remap target if copied else keep original
          clip.structConnections.forEach((conn) => {
            const newSourceId = idMap.get(conn.sourceId);
            const targetId = idMap.get(conn.targetId) ?? conn.targetId;
            if (newSourceId) {
              addConnection({
                sourceInstanceId: newSourceId,
                sourceFieldName: conn.fieldName,
                targetInstanceId: targetId,
                targetFieldName: conn.targetFieldName,
              });
            }
          });

          // Pointer targets: remap pointer (always copied), remap target if copied else keep original
          clip.pointerTargets.forEach((pt) => {
            const newPtrId = idMap.get(pt.pointerId);
            const targetId = idMap.get(pt.targetId) ?? pt.targetId;
            if (newPtrId) {
              updatePointerInstanceTarget(newPtrId, targetId, pt.targetFieldName);
            }
          });

          // Select only the pasted nodes
          setTimeout(() => {
            setNodes((nds) =>
              nds.map((node) => ({
                ...node,
                selected: allNewNodeIds.includes(node.id),
              })),
            );
          }, 10);
        }, 50);

        return allNewNodeIds;
      };

      // Duplicate nodes (Ctrl+D or Cmd+D)
      if ((event.ctrlKey || event.metaKey) && event.key === "d") {
        const selectedNodes = nodes.filter((node) => node.selected);
        if (selectedNodes.length > 0) {
          event.preventDefault();
          const selectedNodeIds = selectedNodes.map((node) => node.id);
          const clip = snapshotClipboard(selectedNodeIds);
          setClipboard(clip);
          pasteFromClipboard(clip, { x: 50, y: 50 });
          showAlert({
            type: "success",
            message: `Duplicated ${selectedNodes.length} node${selectedNodes.length > 1 ? "s" : ""}`,
            duration: 2000,
          });
        }
        return;
      }

      // Copy nodes (Ctrl+C or Cmd+C)
      if ((event.ctrlKey || event.metaKey) && event.key === "c") {
        const selectedNodes = nodes.filter((node) => node.selected);
        if (selectedNodes.length > 0) {
          event.preventDefault();
          setClipboard(snapshotClipboard(selectedNodes.map((n) => n.id)));
          showAlert({
            type: "success",
            message: `Copied ${selectedNodes.length} node${selectedNodes.length > 1 ? "s" : ""}`,
            duration: 1500,
          });
        }
      }

      // Paste nodes (Ctrl+V or Cmd+V)
      if ((event.ctrlKey || event.metaKey) && event.key === "v") {
        if (clipboard && clipboard.nodeIds.length > 0) {
          event.preventDefault();
          const newIds = pasteFromClipboard(clipboard, { x: 50, y: 50 });
          if (newIds.length > 0) {
            showAlert({
              type: "success",
              message: `Pasted ${newIds.length} node${newIds.length > 1 ? "s" : ""}`,
              duration: 1500,
            });
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
        showAlert({
          type: "success",
          message: `Selected all ${nodes.length} nodes`,
          duration: 2000,
        });
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
    removeInstances,
    removePointerInstances,
    clipboard,
    instances,
    pointerInstances,
    connections,
    structDefinitions,
    addInstance,
    addConnection,
    addPointerInstance,
    updatePointerInstanceTarget,
    highlightedPath,
    showEditor,
    connectionPopup,
    contextMenu,
    quickAddMenu,
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
  }, [instances, structDefinitions, highlightedPath, pointerInstances]);

  useEffect(() => {
    setEdges(reactFlowEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections, instances, highlightedPath, pointerInstances]); // Re-calculate edges when instances move or path changes

  // Sync positions when nodes are dragged
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node, allNodes: Node[]) => {
      // If the dragged node is selected, update all selected nodes
      if (node.selected) {
        const selectedNodes = allNodes.filter((n) => n.selected);
        selectedNodes.forEach((n) => {
          if (n.type === "pointerNode") {
            updatePointerInstancePosition(n.id, n.position);
          } else {
            updateInstancePosition(n.id, n.position);
          }
        });
      } else {
        if (node.type === "pointerNode") {
          updatePointerInstancePosition(node.id, node.position);
        } else {
          updateInstancePosition(node.id, node.position);
        }
      }
      // Save history after drag is complete
      saveHistory();
    },
    [updateInstancePosition, updatePointerInstancePosition, saveHistory],
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
        const { nodeIds } = calculatePointerPath(node.id);
        setHighlightedPath(nodeIds);
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

      // Check if this is a standalone pointer node connection
      if (connection.sourceHandle.startsWith("pointer-source-")) {
        const pointerInstanceId = connection.sourceHandle.replace(
          "pointer-source-",
          "",
        );
        const pointerInst = pointerInstances.find(
          (pi) => pi.id === pointerInstanceId,
        );
        if (!pointerInst) return;

        // Check if already connected
        if (pointerInst.targetInstanceId) {
          showAlert({
            type: "warning",
            message:
              "This pointer is already connected! Right-click the connection arrow to disconnect it first.",
            duration: 4000,
          });
          return;
        }

        // Determine if target is a pointer or a struct
        const targetIsPointer = connection.targetHandle?.startsWith("pointer-target-") ?? false;

        if (targetIsPointer) {
          // --- Pointer-to-pointer connection ---
          const targetPointerInst = pointerInstances.find(
            (pi) => pi.id === connection.target,
          );
          if (!targetPointerInst) return;

          // Validate with canConnectPointerToPointer
          if (!canConnectPointerToPointer(
            pointerInst.type,
            pointerInst.pointerLevel,
            targetPointerInst.type,
            targetPointerInst.pointerLevel,
            structDefinitions,
          )) {
            const stars = (n: number) => "*".repeat(n);
            showAlert({
              type: "error",
              message: `Type mismatch! ${pointerInst.type}${stars(pointerInst.pointerLevel)} cannot point to ${targetPointerInst.type}${stars(targetPointerInst.pointerLevel)}.`,
              duration: 4000,
            });
            return;
          }

          // Cycle detection: walk forward from target, if we reach source it's a cycle
          const wouldCycle = (sourceId: string, targetId: string): boolean => {
            let current: string | null = targetId;
            const visited = new Set<string>();
            while (current) {
              if (current === sourceId) return true;
              if (visited.has(current)) return false;
              visited.add(current);
              const pi = pointerInstances.find((p) => p.id === current);
              current = pi?.targetInstanceId ?? null;
            }
            return false;
          };

          if (wouldCycle(pointerInst.id, targetPointerInst.id)) {
            showAlert({
              type: "error",
              message: "Cannot create a circular pointer chain!",
              duration: 4000,
            });
            return;
          }

          updatePointerInstanceTarget(pointerInstanceId, connection.target!);
          return;
        }

        // --- Pointer-to-field connection ---
        const targetIsField = connection.targetHandle?.startsWith("field-target-") ?? false;

        if (targetIsField) {
          // Struct-type pointers (non-primitive, non-void) should connect to the whole struct,
          // not a specific field — fall through to pointer-to-struct branch below
          const isStructTypePointer = !isPrimitiveType(pointerInst.type) && pointerInst.type !== "void";

          if (!isStructTypePointer) {
            // Parse handle ID: field-target-{instanceId}-{fieldName}
            // Instance IDs may contain hyphens, so match against known instance IDs
            const handleSuffix = connection.targetHandle!.replace("field-target-", "");
            let targetInstanceId: string | null = null;
            let targetFieldNameParsed: string | null = null;

            for (const inst of instances) {
              if (handleSuffix.startsWith(inst.id + "-")) {
                targetInstanceId = inst.id;
                targetFieldNameParsed = handleSuffix.slice(inst.id.length + 1);
                break;
              }
            }

            if (!targetInstanceId || !targetFieldNameParsed) return;

            const targetInst = instances.find((i) => i.id === targetInstanceId);
            if (!targetInst) return;

            const targetStruct = structDefinitions.find(
              (s) => s.name === targetInst.structName,
            );
            if (!targetStruct) return;

            const targetField = targetStruct.fields.find(
              (f) => f.name === targetFieldNameParsed,
            );
            if (!targetField) return;

            // Reject multi-level pointers
            if (pointerInst.pointerLevel >= 2) {
              const stars = "*".repeat(pointerInst.pointerLevel);
              showAlert({
                type: "error",
                message: `${pointerInst.type}${stars} cannot target a field. Only single-level pointers can target fields.`,
                duration: 4000,
              });
              return;
            }

            // Validate with canConnectPointerToField
            if (!canConnectPointerToField(
              pointerInst.type,
              pointerInst.pointerLevel,
              targetField.type,
              targetField.isPointer,
              targetField.isArray,
              structDefinitions,
            )) {
              showAlert({
                type: "error",
                message: `Type mismatch! ${pointerInst.type}* cannot point to field '${targetField.name}' (${targetField.type}).`,
                duration: 4000,
              });
              return;
            }

            updatePointerInstanceTarget(pointerInstanceId, targetInstanceId, targetFieldNameParsed);
            return;
          }
          // Struct-type pointers fall through to whole-struct connection below
        }

        // --- Pointer-to-struct connection (existing behavior) ---
        const targetInstance = instances.find(
          (i) => i.id === connection.target,
        );
        if (!targetInstance) return;

        // Level >= 2 pointers must point to a pointer first, not directly to a struct
        if (pointerInst.pointerLevel >= 2) {
          const stars = "*".repeat(pointerInst.pointerLevel);
          showAlert({
            type: "error",
            message: `${pointerInst.type}${stars} must point to a ${pointerInst.type}${"*".repeat(pointerInst.pointerLevel - 1)} pointer first, not directly to a struct instance.`,
            duration: 4000,
          });
          return;
        }

        // Primitive-type pointers (non-void) must target a specific field, not whole structs
        if (isPrimitiveType(pointerInst.type) && pointerInst.type !== "void") {
          showAlert({
            type: "error",
            message: `${pointerInst.type}* must target a specific field. Drop the connection on a field row instead of the struct header.`,
            duration: 4000,
          });
          return;
        }

        // Type validation
        const resolvedPointerType = resolveTypeName(
          pointerInst.type,
          structDefinitions,
        );
        const resolvedTargetType = resolveTypeName(
          targetInstance.structName,
          structDefinitions,
        );

        if (!canConnectPointer(resolvedPointerType, resolvedTargetType)) {
          showAlert({
            type: "error",
            message: `Type mismatch! ${pointerInst.type}${"*".repeat(pointerInst.pointerLevel)} cannot point to struct ${targetInstance.structName}.`,
            duration: 4000,
          });
          return;
        }

        updatePointerInstanceTarget(pointerInstanceId, connection.target!);
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
        showAlert({
          type: "error",
          message: "Only pointer fields can create connections!",
        });
        return;
      }

      // Handle struct-field-source -> field-target connection
      if (connection.targetHandle?.startsWith("field-target-")) {
        const handleSuffix = connection.targetHandle.replace("field-target-", "");
        let targetInstId: string | null = null;
        let targetFldName: string | null = null;

        for (const inst of instances) {
          if (handleSuffix.startsWith(inst.id + "-")) {
            targetInstId = inst.id;
            targetFldName = handleSuffix.slice(inst.id.length + 1);
            break;
          }
        }

        if (!targetInstId || !targetFldName) return;

        const targetInst = instances.find((i) => i.id === targetInstId);
        if (!targetInst) return;

        const targetStruct = structDefinitions.find(
          (s) => s.name === targetInst.structName,
        );
        if (!targetStruct) return;

        const targetField = targetStruct.fields.find(
          (f) => f.name === targetFldName,
        );
        if (!targetField) return;

        // Validate with canConnectPointerToField
        if (!canConnectPointerToField(
          sourceField.type,
          sourceField.pointerLevel || 1,
          targetField.type,
          targetField.isPointer,
          targetField.isArray,
          structDefinitions,
        )) {
          showAlert({
            type: "error",
            message: `Type mismatch! ${sourceField.type}* cannot point to field '${targetField.name}' (${targetField.type}).`,
            duration: 4000,
          });
          return;
        }

        // Check existing connection
        const existingFieldConn = connections.find(
          (conn) =>
            conn.sourceInstanceId === connection.source &&
            conn.sourceFieldName === fieldName,
        );

        if (existingFieldConn) {
          showAlert({
            type: "warning",
            message: `This pointer is already connected! Right-click the connection arrow to delete it first.`,
            duration: 4000,
          });
          return;
        }

        addConnection({
          sourceInstanceId: connection.source,
          sourceFieldName: fieldName,
          targetInstanceId: targetInstId,
          targetFieldName: targetFldName,
        });

        setEdges((eds) => addEdge(connection, eds));
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
        showAlert({
          type: "error",
          message: `Type mismatch! ${sourceField.type}* cannot point to struct ${targetInstance.structName}. Make sure pointer types match the target struct.`,
          duration: 4000,
        });
        return;
      }

      // IMPORTANT: Check if this pointer already has a connection
      const existingConnection = connections.find(
        (conn) =>
          conn.sourceInstanceId === connection.source &&
          conn.sourceFieldName === fieldName,
      );

      if (existingConnection) {
        showAlert({
          type: "warning",
          message: `This pointer is already connected! Right-click the connection arrow to delete it first.`,
          duration: 4000,
        });
        return;
      }

      // SMART CONNECTION: If user dropped on the main target handle (not a specific field handle),
      // try to find the first compatible pointer target field in the target struct
      if (
        connection.targetHandle?.startsWith("target-") &&
        connection.targetHandle?.endsWith(`-${connection.target}`)
      ) {
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
    [instances, structDefinitions, addConnection, setEdges, connections, pointerInstances, updatePointerInstanceTarget],
  );

  // Handle edge click for highlighting source and target nodes (left-click)
  const handleEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    // Highlight both the source and target nodes
    const sourceId = edge.source;
    const targetId = edge.target;

    if (sourceId && targetId) {
      setHighlightedPath(new Set([sourceId, targetId]));
    }
  }, []);

  // Handle edge context menu (right-click) for deletion
  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault(); // Prevent default context menu

      // Handle pointer edge disconnection
      if (edge.data?.pointerInstanceId) {
        updatePointerInstanceTarget(
          edge.data.pointerInstanceId as string,
          null,
        );
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
        showAlert({
          type: "success",
          message: "Pointer disconnected (set to NULL)",
          duration: 2000,
        });
        return;
      }

      if (edge.data?.connectionId) {
        removeConnection(edge.data.connectionId as string);
        // Also remove from React Flow's edge state
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
        showAlert({
          type: "success",
          message: "Connection deleted",
          duration: 2000,
        });
      }
    },
    [removeConnection, setEdges, updatePointerInstanceTarget],
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

      // Allow pointer node source handles to connect to struct, pointer, or field target handles
      if (connection.sourceHandle.startsWith("pointer-source-")) {
        if (connection.source === connection.target) return false; // no self-loops
        // Allow null targetHandle (ConnectionMode.Loose with multiple handles) — handleConnect resolves the target
        if (!connection.targetHandle) return true;
        const targetIsStruct = connection.targetHandle.startsWith("target-");
        const targetIsPointer = connection.targetHandle.startsWith("pointer-target-");
        const targetIsField = connection.targetHandle.startsWith("field-target-");
        return targetIsStruct || targetIsPointer || targetIsField;
      }

      // Allow connections from source handles to target handles or field target handles
      return (
        connection.sourceHandle.includes("-") &&
        (!connection.targetHandle ||
         connection.targetHandle.startsWith("target-") ||
         connection.targetHandle.startsWith("field-target-"))
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

      // Get mouse position (screen coordinates for popup)
      const mouseEvent = event as MouseEvent;
      const screenPosition = {
        x: mouseEvent.clientX,
        y: mouseEvent.clientY,
      };

      // Convert to flow coordinates for spawning the struct
      const flowPosition = screenToFlowPosition({
        x: mouseEvent.clientX,
        y: mouseEvent.clientY,
      });

      // Show connection popup and reset search
      setConnectionPopup({
        show: true,
        sourceInstanceId,
        sourceFieldName: fieldName,
        pointerType: sourceField.type,
        position: screenPosition,
        flowPosition, // Store flow position for spawning
      });
      setPopupSearch(""); // Reset search when popup opens
    },
    [instances, structDefinitions, screenToFlowPosition],
  );

  // Smart auto-layout system that detects patterns and applies appropriate layouts
  const handleCleanupLayout = useCallback(async () => {
    if (instances.length === 0) return;

    try {
      await performSmartLayout(
        instances,
        connections,
        structDefinitions,
        updateInstancePosition,
      );
    } catch (error) {
      console.error("Smart layout error:", error);
      showAlert({
        type: "error",
        message: "Failed to apply auto-layout. Please try again.",
        duration: 3000,
      });
    }
  }, [instances, connections, updateInstancePosition, structDefinitions]);

  // Handle drag and drop from sidebar
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      // Check for pointer drop first
      const pointerId = event.dataTransfer.getData("application/pointer");
      if (pointerId) {
        const pointerDef = pointerDefinitions.find((p) => p.id === pointerId);
        if (!pointerDef) return;

        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        position.x = Math.round(position.x / 20) * 20;
        position.y = Math.round(position.y / 20) * 20;

        const newInstance: PointerInstance = {
          id: `ptr-inst-${Date.now()}-${Math.random()}`,
          pointerVariableId: pointerDef.id,
          name: pointerDef.name,
          type: pointerDef.type,
          pointerLevel: pointerDef.pointerLevel,
          position,
          targetInstanceId: null,
          targetFieldName: null,
          color: pointerDef.color,
        };

        addPointerInstance(newInstance);
        return;
      }

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
    [structDefinitions, addInstance, screenToFlowPosition, pointerDefinitions, addPointerInstance],
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

  const activeTab = workspaceTabs.find(t => t.id === activeWorkspaceId);
  const isVisualizerMode = activeTab?.mode === "visualizer";

  if (isVisualizerMode) {
    return (
      <>
        <WorkspaceTabBar onOpenCommandPalette={() => setShowCommandPalette(true)} />
        <CodeVisualizerLayout />
        <CommandPalette
          isOpen={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          mode="visualizer"
          onOpenSettings={() => setShowSettings(true)}
          onShowHowToUse={() => setShowHowToUse(true)}
          onExportPNG={handleHeapExportPNG}
          onExportSVG={handleHeapExportSVG}
          onExportPDF={handleHeapExportPDF}
          onCopyToClipboard={handleHeapCopyToClipboard}
        />
        {showSettings && (
          <Settings
            onClose={() => setShowSettings(false)}
            snapToGrid={snapToGrid}
            onSnapToGridChange={setSnapToGrid}
          />
        )}
        {showHowToUse && (
          <HowToUseGuide onClose={() => setShowHowToUse(false)} />
        )}
      </>
    );
  }

  return (
    <>
    <WorkspaceTabBar onOpenCommandPalette={() => setShowCommandPalette(true)} />
    <div ref={reactFlowWrapper} className="w-screen h-[calc(100vh-1.75rem)] mt-7 bg-gray-50">
      <AlertContainer />
      {/* Sidebar Toggle Button - On the edge of sidebar */}
      <button
        onClick={() => setShowSidebar(!showSidebar)}
        className="fixed top-1/2 -translate-y-1/2 z-30 transition-all duration-500 ease-in-out border-2 border-black rounded-base shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
        style={{
          backgroundColor: UI_COLORS.cyan,
          left: showSidebar ? "16.5rem" : "0.5rem",
          width: "2rem",
          height: "2.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        title={showSidebar ? "Hide Sidebar" : "Show Sidebar"}
      >
        {showSidebar ? (
          <ChevronLeft size={18} strokeWidth={3} />
        ) : (
          <ChevronRight size={18} strokeWidth={3} />
        )}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed top-7 left-0 h-[calc(100vh-1.75rem)] z-20 transition-transform duration-500 ease-in-out ${
          showSidebar ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          onEditStruct={(structName) => {
            setEditingStructName(structName);
            setShowEditor(true);
          }}
          onAddInstance={handleAddInstanceFromSidebar}
          onDefineStruct={() => {
            setEditingStructName(undefined);
            setShowEditor(true);
          }}
        />
      </div>

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
        isValidConnection={isValidConnection}
        deleteKeyCode={null}
        fitView
        className={`bg-gray-50 ${showSidebar ? "ml-64" : "ml-0"}`}
        elevateEdgesOnSelect={true}
        snapToGrid={snapToGrid}
        snapGrid={[20, 20]}
        connectOnClick={true}
        defaultEdgeOptions={{
          type: "smoothstep",
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
      </ReactFlow>

      {/* Pointer Menu - Right Side */}
      <PointerMenu
        isOpen={showPointerMenu}
        onToggle={() => setShowPointerMenu(!showPointerMenu)}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        mode="free"
        onOpenSettings={() => setShowSettings(true)}
        onShowHowToUse={() => setShowHowToUse(true)}
        onSaveWorkspace={handleSaveWorkspace}
        onLoadWorkspace={handleLoadWorkspace}
        onOpenTemplates={() => setShowTemplateManager(true)}
        onExportPNG={handleExportPNG}
        onExportSVG={handleExportSVG}
        onExportPDF={handleExportPDF}
        onCopyToClipboard={handleCopyToClipboard}
      />

      {/* Dock - Bottom Center */}
      <Dock
        isSelecting={isSelecting}
        onToggleSelection={() => setIsSelecting(!isSelecting)}
        onUndo={() => {
          undo();
          showAlert({ type: "success", message: "Undo", duration: 1000 });
        }}
        onRedo={() => {
          redo();
          showAlert({ type: "success", message: "Redo", duration: 1000 });
        }}
        onFitView={() => fitView({ padding: 0.3, duration: 300, maxZoom: 0.9 })}
        onAutoLayout={handleCleanupLayout}
        onClearWorkspace={() => {
          showAlert({
            type: "confirm",
            message:
              "Clear workspace? This will remove all instances and connections.",
            onConfirm: () => {
              clearAll();
              showAlert({
                type: "success",
                message: "Workspace cleared",
                duration: 2000,
              });
            },
            confirmText: "Clear",
            cancelText: "Cancel",
          });
        }}
        undoDisabled={historyIndex <= 0 || !history || history.length === 0}
        redoDisabled={
          !history ||
          history.length === 0 ||
          historyIndex >= history.length - 1
        }
      />

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

      {/* Template Manager */}
      {showTemplateManager && (
        <TemplateManager
          isOpen={showTemplateManager}
          onClose={() => setShowTemplateManager(false)}
        />
      )}

      {showHowToUse && (
        <WelcomeScreen onDismiss={() => setShowHowToUse(false)} />
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
            className="fixed z-30 bg-white rounded-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] border-4 border-black p-3 min-w-[280px]"
            style={{
              left: connectionPopup.position.x,
              top: connectionPopup.position.y,
            }}
          >
            <div className="text-sm font-mono font-bold text-black px-2 py-1 border-b-2 border-black mb-2">
              {connectionPopup.pointerType}*
            </div>

            {/* Search input */}
            <Input
              type="text"
              value={popupSearch}
              onChange={(e) => setPopupSearch(e.target.value)}
              className="w-full mb-2 font-mono font-heading"
              placeholder="Search structs..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  // Get the filtered and sorted structs (only compatible types)
                  const filteredStructs = structDefinitions
                    .slice()
                    .filter((struct) => {
                      // Resolve pointer type and struct name to handle typedef
                      const resolvedPointerType = resolveTypeName(
                        connectionPopup.pointerType,
                        structDefinitions,
                      );
                      const resolvedStructName = resolveTypeName(
                        struct.name,
                        structDefinitions,
                      );

                      // ONLY show compatible types
                      const isCompatible =
                        connectionPopup.pointerType === "void" ||
                        resolvedPointerType === resolvedStructName ||
                        struct.name === connectionPopup.pointerType ||
                        struct.typedef === connectionPopup.pointerType;

                      if (!isCompatible) return false;

                      if (popupSearch.trim() === "") return true;
                      return struct.name
                        .toLowerCase()
                        .includes(popupSearch.toLowerCase());
                    })
                    .sort((a, b) => {
                      // Resolve for sorting
                      const resolvedPointerType = resolveTypeName(
                        connectionPopup.pointerType,
                        structDefinitions,
                      );
                      const resolvedA = resolveTypeName(
                        a.name,
                        structDefinitions,
                      );
                      const resolvedB = resolveTypeName(
                        b.name,
                        structDefinitions,
                      );

                      const aMatches =
                        connectionPopup.pointerType === "void" ||
                        resolvedPointerType === resolvedA ||
                        a.name === connectionPopup.pointerType ||
                        a.typedef === connectionPopup.pointerType;
                      const bMatches =
                        connectionPopup.pointerType === "void" ||
                        resolvedPointerType === resolvedB ||
                        b.name === connectionPopup.pointerType ||
                        b.typedef === connectionPopup.pointerType;
                      if (aMatches && !bMatches) return -1;
                      if (!aMatches && bMatches) return 1;
                      return 0;
                    });

                  // Select the first one
                  if (filteredStructs.length > 0) {
                    const topStruct = filteredStructs[0];

                    // Use the flow position where the user dropped the pointer
                    const newPosition = connectionPopup.flowPosition
                      ? {
                          x:
                            Math.round(connectionPopup.flowPosition.x / 20) *
                            20,
                          y:
                            Math.round(connectionPopup.flowPosition.y / 20) *
                            20,
                        }
                      : {
                          x: 0,
                          y: 0,
                        };

                    addInstance(topStruct, newPosition, undefined);

                    setTimeout(() => {
                      const updatedInstances =
                        useCanvasStore.getState().instances;
                      const newInstance =
                        updatedInstances[updatedInstances.length - 1];
                      if (newInstance) {
                        // Check if this pointer already has a connection and remove it
                        const existingConnection = connections.find(
                          (conn) =>
                            conn.sourceInstanceId ===
                              connectionPopup.sourceInstanceId &&
                            conn.sourceFieldName ===
                              connectionPopup.sourceFieldName,
                        );

                        if (existingConnection) {
                          removeConnection(existingConnection.id);
                        }

                        // Create the new connection
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
            />

            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {structDefinitions
                .slice() // Create a copy to avoid mutating original
                .filter((struct) => {
                  // Resolve pointer type and struct name to handle typedef
                  const resolvedPointerType = resolveTypeName(
                    connectionPopup.pointerType,
                    structDefinitions,
                  );
                  const resolvedStructName = resolveTypeName(
                    struct.name,
                    structDefinitions,
                  );

                  // ONLY show compatible types: void* can point to anything, otherwise must match exactly
                  const isCompatible =
                    connectionPopup.pointerType === "void" ||
                    resolvedPointerType === resolvedStructName ||
                    struct.name === connectionPopup.pointerType ||
                    struct.typedef === connectionPopup.pointerType;

                  if (!isCompatible) return false;

                  // Filter by search term
                  if (popupSearch.trim() === "") return true;
                  return struct.name
                    .toLowerCase()
                    .includes(popupSearch.toLowerCase());
                })
                .sort((a, b) => {
                  // Resolve for sorting
                  const resolvedPointerType = resolveTypeName(
                    connectionPopup.pointerType,
                    structDefinitions,
                  );
                  const resolvedA = resolveTypeName(a.name, structDefinitions);
                  const resolvedB = resolveTypeName(b.name, structDefinitions);

                  // Sort: exact type matches first, then maintain sidebar order
                  const aMatches =
                    connectionPopup.pointerType === "void" ||
                    resolvedPointerType === resolvedA ||
                    a.name === connectionPopup.pointerType ||
                    a.typedef === connectionPopup.pointerType;
                  const bMatches =
                    connectionPopup.pointerType === "void" ||
                    resolvedPointerType === resolvedB ||
                    b.name === connectionPopup.pointerType ||
                    b.typedef === connectionPopup.pointerType;

                  if (aMatches && !bMatches) return -1; // a comes first
                  if (!aMatches && bMatches) return 1; // b comes first
                  return 0; // Keep original sidebar order for same category
                })
                .map((struct) => {
                  // Resolve for match highlighting
                  const resolvedPointerType = resolveTypeName(
                    connectionPopup.pointerType,
                    structDefinitions,
                  );
                  const resolvedStructName = resolveTypeName(
                    struct.name,
                    structDefinitions,
                  );

                  const isExactMatch =
                    connectionPopup.pointerType === "void" ||
                    resolvedPointerType === resolvedStructName ||
                    struct.name === connectionPopup.pointerType ||
                    struct.typedef === connectionPopup.pointerType;

                  return (
                    <button
                      key={struct.name}
                      onClick={() => {
                        // Use the flow position where the user dropped the pointer
                        const newPosition = connectionPopup.flowPosition
                          ? {
                              x:
                                Math.round(
                                  connectionPopup.flowPosition.x / 20,
                                ) * 20,
                              y:
                                Math.round(
                                  connectionPopup.flowPosition.y / 20,
                                ) * 20,
                            }
                          : {
                              x: 0,
                              y: 0,
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
                            // Check if this pointer already has a connection and remove it
                            const existingConnection = connections.find(
                              (conn) =>
                                conn.sourceInstanceId ===
                                  connectionPopup.sourceInstanceId &&
                                conn.sourceFieldName ===
                                  connectionPopup.sourceFieldName,
                            );

                            if (existingConnection) {
                              removeConnection(existingConnection.id);
                            }

                            // Create the new connection
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
                      className={`w-full text-left px-3 py-2 text-sm font-mono font-bold hover:bg-[#90CAF9] rounded-none transition flex items-center gap-2 border-2 ${
                        isExactMatch
                          ? "bg-[#E0BBE4] border-black"
                          : "border-transparent hover:border-black"
                      }`}
                    >
                      <Plus
                        size={16}
                        strokeWidth={2.5}
                        className="text-black"
                      />
                      <span className="text-black">{struct.name}</span>
                    </button>
                  );
                })}

              {/* Show message if no compatible structs found */}
              {structDefinitions.filter((struct) => {
                const resolvedPointerType = resolveTypeName(
                  connectionPopup.pointerType,
                  structDefinitions,
                );
                const resolvedStructName = resolveTypeName(
                  struct.name,
                  structDefinitions,
                );
                const isCompatible =
                  connectionPopup.pointerType === "void" ||
                  resolvedPointerType === resolvedStructName ||
                  struct.name === connectionPopup.pointerType ||
                  struct.typedef === connectionPopup.pointerType;
                return isCompatible;
              }).length === 0 && (
                <div className="px-3 py-4 text-center text-sm font-base text-gray-600 border-2 border-dashed border-gray-300 rounded-base mx-2">
                  <p className="font-heading mb-1">
                    No compatible struct found
                  </p>
                  <p className="text-xs">
                    Pointer type:{" "}
                    <span className="font-mono font-bold">
                      {connectionPopup.pointerType}*
                    </span>
                  </p>
                  <p className="text-xs mt-2 opacity-70">
                    Define struct "{connectionPopup.pointerType}" first to
                    create instances
                  </p>
                </div>
              )}

              {/* Option to cancel */}
              <div className="border-t-2 border-black mt-2 pt-2">
                <button
                  onClick={() => setConnectionPopup(null)}
                  className="w-full text-center px-3 py-1.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-none transition border-2 border-black"
                >
                  ESC
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
            className="fixed z-30 bg-white rounded-base border-2 border-black shadow-shadow min-w-[200px] overflow-hidden"
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
                          showAlert({
                            type: "error",
                            message: "Circular reference detected!",
                            duration: 3000,
                          });
                        }
                      }
                    }
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-4 py-3 text-sm font-heading border-b-2 border-black hover:bg-main hover:text-white transition-colors"
                >
                  Highlight Path
                </button>
                <button
                  onClick={() => {
                    const nodeId = contextMenu.nodeId!;
                    const structConns = connections
                      .filter((conn) => conn.sourceInstanceId === nodeId)
                      .map((conn) => ({
                        sourceId: conn.sourceInstanceId,
                        targetId: conn.targetInstanceId,
                        fieldName: conn.sourceFieldName,
                        targetFieldName: conn.targetFieldName ?? null,
                      }));
                    const ptrTargets = pointerInstances
                      .filter((pi) => pi.id === nodeId && pi.targetInstanceId)
                      .map((pi) => ({
                        pointerId: pi.id,
                        targetId: pi.targetInstanceId!,
                        targetFieldName: pi.targetFieldName,
                      }));
                    setClipboard({ nodeIds: [nodeId], structConnections: structConns, pointerTargets: ptrTargets });
                    setContextMenu(null);
                    showAlert({
                      type: "success",
                      message: "Node copied",
                      duration: 2000,
                    });
                  }}
                  className="w-full text-left px-4 py-3 text-sm font-heading border-b-2 border-black hover:bg-main hover:text-white transition-colors"
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
                        showAlert({
                          type: "success",
                          message: "Node duplicated",
                          duration: 2000,
                        });
                      }
                    }
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-4 py-3 text-sm font-heading border-b-2 border-black hover:bg-main hover:text-white transition-colors"
                >
                  Duplicate Node
                </button>
                <button
                  onClick={() => {
                    const nodeId = contextMenu.nodeId!;
                    setContextMenu(null);

                    showAlert({
                      type: "confirm",
                      message: "Delete this node and all its connections?",
                      onConfirm: () => {
                        // Check if it's a pointer node or struct node
                        const isPointer = pointerInstances.some(
                          (pi) => pi.id === nodeId,
                        );
                        if (isPointer) {
                          removePointerInstance(nodeId);
                        } else {
                          removeInstance(nodeId);
                        }
                        showAlert({
                          type: "success",
                          message: "Node deleted",
                          duration: 2000,
                        });
                      },
                      confirmText: "Delete",
                      cancelText: "Cancel",
                    });
                  }}
                  className="w-full text-left px-4 py-3 text-sm font-heading text-red-600 hover:bg-red-100 transition-colors"
                >
                  Delete Node
                </button>
              </>
            ) : (
              // Canvas context menu
              <>
                <button
                  onClick={() => {
                    if (clipboard && clipboard.nodeIds.length > 0) {
                      const idMap = new Map<string, string>();
                      const allNewNodeIds: string[] = [];

                      clipboard.nodeIds.forEach((nodeId) => {
                        const instance = instances.find((i) => i.id === nodeId);
                        if (instance) {
                          const struct = structDefinitions.find((s) => s.name === instance.structName);
                          if (struct) {
                            const newInstance = addInstance(struct, {
                              x: instance.position.x + 50,
                              y: instance.position.y + 50,
                            }, undefined);
                            if (newInstance) {
                              idMap.set(nodeId, newInstance.id);
                              allNewNodeIds.push(newInstance.id);
                            }
                          }
                        }
                        const ptrInst = pointerInstances.find((pi) => pi.id === nodeId);
                        if (ptrInst) {
                          const newId = `ptrinst-${Date.now()}-${Math.random()}`;
                          addPointerInstance({
                            ...ptrInst,
                            id: newId,
                            position: {
                              x: ptrInst.position.x + 50,
                              y: ptrInst.position.y + 50,
                            },
                            targetInstanceId: null,
                            targetFieldName: null,
                          });
                          idMap.set(nodeId, newId);
                          allNewNodeIds.push(newId);
                        }
                      });

                      setTimeout(() => {
                        clipboard.structConnections.forEach((conn) => {
                          const newSourceId = idMap.get(conn.sourceId);
                          const targetId = idMap.get(conn.targetId) ?? conn.targetId;
                          if (newSourceId) {
                            addConnection({
                              sourceInstanceId: newSourceId,
                              sourceFieldName: conn.fieldName,
                              targetInstanceId: targetId,
                              targetFieldName: conn.targetFieldName,
                            });
                          }
                        });
                        clipboard.pointerTargets.forEach((pt) => {
                          const newPtrId = idMap.get(pt.pointerId);
                          const targetId = idMap.get(pt.targetId) ?? pt.targetId;
                          if (newPtrId) {
                            updatePointerInstanceTarget(newPtrId, targetId, pt.targetFieldName);
                          }
                        });
                        setTimeout(() => {
                          setNodes((nds) =>
                            nds.map((node) => ({
                              ...node,
                              selected: allNewNodeIds.includes(node.id),
                            })),
                          );
                        }, 10);
                      }, 50);
                    }
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-4 py-3 text-sm font-heading border-b-2 border-black hover:bg-main hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-black"
                  disabled={!clipboard || clipboard.nodeIds.length === 0}
                >
                  Paste Node{clipboard && clipboard.nodeIds.length > 1 ? "s" : ""}
                </button>
                <button
                  onClick={() => {
                    setHighlightedPath(new Set());
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-4 py-3 text-sm font-heading border-b-2 border-black hover:bg-main hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-black"
                  disabled={highlightedPath.size === 0}
                >
                  Clear Highlights
                </button>
                <button
                  onClick={() => {
                    handleCleanupLayout();
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-4 py-3 text-sm font-heading hover:bg-main hover:text-white transition-colors"
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
            className="fixed z-30 bg-white rounded-base border-2 border-black shadow-shadow min-w-[240px] overflow-hidden"
            style={{
              left: quickAddMenu.x,
              top: quickAddMenu.y,
            }}
          >
            <div className="px-4 py-3 font-heading text-sm border-b-2 border-black bg-main text-white">
              Add Node
            </div>
            <div className="max-h-[320px] overflow-y-auto">
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
                  className="w-full text-left px-4 py-3 text-sm font-mono border-b-2 border-black hover:bg-main hover:text-white transition-colors"
                >
                  {struct.name}
                </button>
              ))}

              {structDefinitions.length === 0 && (
                <div className="text-center text-gray-500 text-sm font-base py-6">
                  No structs defined
                </div>
              )}
            </div>

            <div className="p-2 border-t-2 border-black bg-gray-50">
              <Button
                onClick={() => {
                  setQuickAddMenu(null);
                  setEditingStructName(undefined);
                  setShowEditor(true);
                }}
                className="w-full"
                style={{ backgroundColor: UI_COLORS.green }}
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>New Struct</span>
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
    </>
  );
}

const WELCOME_KEY = "c-struct-viz-welcomed";

function App() {
  const [showWelcome, setShowWelcome] = useState(() => {
    return !localStorage.getItem(WELCOME_KEY);
  });

  const handleDismissWelcome = () => {
    localStorage.setItem(WELCOME_KEY, "1");
    setShowWelcome(false);
  };

  return (
    <ReactFlowProvider>
      {showWelcome && <WelcomeScreen onDismiss={handleDismissWelcome} />}
      <FlowCanvas />
    </ReactFlowProvider>
  );
}

export default App;
