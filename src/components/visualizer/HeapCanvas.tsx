import { useEffect, useCallback, useRef, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeChange,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import { Database, Maximize2, LayoutGrid } from "lucide-react";
import StructNode from "../StructNode";
import { useVisualizerStore } from "../../store/visualizerStore";
import { UI_COLORS } from "../../utils/colors";
import { computeLayout } from "../../utils/smartLayout";

const nodeTypes = {
  structNode: StructNode,
};

const DEFAULT_EDGE_STYLE = {
  stroke: "#374151",
  strokeWidth: 3,
  strokeDasharray: "6 3",
};

const DEFAULT_MARKER = {
  type: "arrowclosed" as const,
  color: "#374151",
  width: 16,
  height: 16,
};

function HeapCanvasInner({
  autoFit,
  autoReorder,
}: {
  autoFit: boolean;
  autoReorder: boolean;
}) {
  const { fitView } = useReactFlow();
  const { heapState } = useVisualizerStore();
  const hoveredPointerId = useVisualizerStore((s) => s.hoveredPointerId);
  const [nodes, setNodes, onNodesChangeRaw] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(
    new Set(),
  );
  // Track user-dragged positions
  const draggedPositionsRef = useRef<
    Map<string, { x: number; y: number }>
  >(new Map());
  // Track positions from last layout computation
  const computedPositionsRef = useRef<
    Map<string, { x: number; y: number }>
  >(new Map());
  const prevNodeCountRef = useRef(0);
  const prevHeapStateRef = useRef(heapState);
  const prevAutoFitRef = useRef(autoFit);
  const prevAutoReorderRef = useRef(autoReorder);

  // Filter out 'remove' changes — nodes are owned by heapState, not React Flow
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChangeRaw(changes.filter((c) => c.type !== "remove"));
    },
    [onNodesChangeRaw],
  );

  // Convert heapState to ReactFlow nodes and edges (structs only — no PointerNodes)
  const { rfNodes, rfEdges } = useMemo(() => {
    if (!heapState) return { rfNodes: [], rfEdges: [] };

    // Build struct positions using topology-aware layout
    const structPositions = new Map<string, { x: number; y: number }>();
    const layoutPositions = computeLayout(
      heapState.structInstances,
      heapState.connections,
    );
    heapState.structInstances.forEach((inst) => {
      const pos =
        inst.position.x === 0 && inst.position.y === 0
          ? layoutPositions.get(inst.id) || { x: 0, y: 0 }
          : inst.position;
      structPositions.set(inst.id, pos);
    });

    // Build a set of connected fields per instance from connections
    const connectedFieldsByInstance = new Map<string, Set<string>>();
    for (const conn of heapState.connections) {
      let set = connectedFieldsByInstance.get(conn.sourceInstanceId);
      if (!set) {
        set = new Set();
        connectedFieldsByInstance.set(conn.sourceInstanceId, set);
      }
      set.add(conn.sourceFieldName);
    }

    // Build a map of pointer field addresses from heap objects
    const objectByAddress = new Map<
      number,
      (typeof heapState.objects)[0]
    >();
    for (const obj of heapState.objects) {
      objectByAddress.set(obj.address, obj);
    }

    const structNodes: Node[] = heapState.structInstances.map((inst) => {
      const structDef = heapState.structDefinitions.find(
        (s) => s.name === inst.structName,
      );

      // Extract pointer field addresses from the heap object
      const pointerFieldAddresses: Record<string, string> = {};
      const addrStr = inst.id.replace("heap-", "");
      const addr = parseInt(addrStr, 10);
      const heapObj = objectByAddress.get(addr);
      if (heapObj) {
        for (const [fieldName, fieldInfo] of Object.entries(heapObj.fields)) {
          if (fieldInfo.isPointer) {
            pointerFieldAddresses[fieldName] =
              fieldInfo.pointsTo != null
                ? `0x${fieldInfo.pointsTo.toString(16)}`
                : "NULL";
          }
        }
      }

      return {
        id: inst.id,
        type: "structNode",
        position: structPositions.get(inst.id)!,
        data: {
          instanceId: inst.id,
          structName: inst.structName,
          instanceName: inst.instanceName,
          fields: structDef?.fields || [],
          fieldValues: inst.fieldValues,
          connectedFields: Array.from(
            connectedFieldsByInstance.get(inst.id) || [],
          ),
          pointerFieldAddresses,
          readOnly: true,
          isClass: structDef?.isClass,
          methods: structDef?.methods?.map(m => ({
            name: m.name,
            returnType: m.returnType,
            accessLevel: m.accessLevel,
            isVirtual: m.isVirtual,
            isConstructor: m.isConstructor,
            isDestructor: m.isDestructor,
          })),
        },
      };
    });

    // Struct-to-struct connections only (no pointer node edges)
    const structEdges: Edge[] = heapState.connections.map((conn) => ({
      id: conn.id,
      source: conn.sourceInstanceId,
      sourceHandle: `${conn.sourceInstanceId}-${conn.sourceFieldName}`,
      target: conn.targetInstanceId,
      targetHandle: conn.targetFieldName
        ? `field-target-${conn.targetInstanceId}-${conn.targetFieldName}`
        : `target-left-${conn.targetInstanceId}`,
      type: "smoothstep",
      style: { ...DEFAULT_EDGE_STYLE },
      markerEnd: { ...DEFAULT_MARKER },
    }));

    return {
      rfNodes: structNodes,
      rfEdges: structEdges,
    };
  }, [heapState]);

  // Handle auto-fit toggle - fit view immediately when turned on
  useEffect(() => {
    if (autoFit && !prevAutoFitRef.current && nodes.length > 0) {
      // Auto-fit was just turned on - fit immediately
      fitView({ padding: 0.3, duration: 300, maxZoom: 0.9 });
    }
    prevAutoFitRef.current = autoFit;
  }, [autoFit, nodes.length, fitView]);

  // Handle auto-reorder toggle - recompute layout immediately when turned on
  useEffect(() => {
    if (autoReorder && !prevAutoReorderRef.current && heapState) {
      // Auto-reorder was just turned on - recompute layout
      draggedPositionsRef.current.clear();
      computedPositionsRef.current.clear();
      
      // Compute new layout positions
      const layoutPositions = computeLayout(
        heapState.structInstances,
        heapState.connections,
      );
      
      // Apply new positions
      layoutPositions.forEach((pos, nodeId) => {
        computedPositionsRef.current.set(nodeId, pos);
      });
      
      // Update nodes with new positions
      const updatedNodes = nodes.map((n) => {
        const newPos = computedPositionsRef.current.get(n.id);
        if (newPos) {
          return { ...n, position: newPos };
        }
        return n;
      });
      
      setNodes(updatedNodes);
      
      // Also fit view if auto-fit is enabled
      if (autoFit) {
        setTimeout(() => fitView({ padding: 0.3, duration: 300, maxZoom: 0.9 }), 50);
      }
    }
    prevAutoReorderRef.current = autoReorder;
  }, [autoReorder, heapState, nodes, setNodes, fitView, autoFit]);

  // Sync nodes/edges from heapState
  useEffect(() => {
    const nodeCount = rfNodes.length;
    const hasNewNodes = rfNodes.some((n) => !computedPositionsRef.current.has(n.id));
    const hasHeapChanged = heapState !== prevHeapStateRef.current;

    // When auto-reorder is on and heap changes, clear dragged positions
    if (autoReorder && hasHeapChanged) {
      draggedPositionsRef.current.clear();
      computedPositionsRef.current.clear();
    }

    // Compute new positions only if:
    // 1. Auto-reorder is enabled AND heap changed, OR
    // 2. There are new nodes that don't have positions yet, OR
    // 3. Node count changed (allocation/free) and auto-reorder is on
    const shouldRecomputeLayout =
      (autoReorder && hasHeapChanged) ||
      hasNewNodes ||
      (autoReorder && nodeCount !== prevNodeCountRef.current);

    if (shouldRecomputeLayout && heapState) {
      // Compute new layout positions
      const layoutPositions = computeLayout(
        heapState.structInstances,
        heapState.connections,
      );

      // Apply new positions
      rfNodes.forEach((n) => {
        const newPos = layoutPositions.get(n.id);
        if (newPos) {
          computedPositionsRef.current.set(n.id, newPos);
        }
      });
    }

    // Apply positions: user-dragged > computed > original
    const merged = rfNodes.map((n) => {
      const draggedPos = draggedPositionsRef.current.get(n.id);
      const computedPos = computedPositionsRef.current.get(n.id);
      // User-dragged positions always take priority
      if (draggedPos) {
        return { ...n, position: draggedPos };
      }
      // Otherwise use computed position
      if (computedPos) {
        return { ...n, position: computedPos };
      }
      // Fallback to original position
      return n;
    });

    setNodes(merged);
    setEdges(rfEdges);

    // Auto-fit when heap changes and auto-fit is enabled
    if (hasHeapChanged && autoFit && nodeCount > 0) {
      setTimeout(() => fitView({ padding: 0.3, duration: 300, maxZoom: 0.9 }), 50);
    }

    // Only clear selection when heap structure actually changed (not just position updates)
    if (hasHeapChanged && selectedNodeIds.size > 0) {
      // Defer state update to avoid setState in effect
      queueMicrotask(() => setSelectedNodeIds(new Set()));
    }

    prevNodeCountRef.current = nodeCount;
    prevHeapStateRef.current = heapState;
  }, [rfNodes, rfEdges, heapState, setNodes, setEdges, fitView, autoFit, autoReorder, selectedNodeIds, setSelectedNodeIds]);

  // Right-click: fitView to re-center
  const handlePaneContextMenu = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      e.preventDefault();
      fitView({ padding: 0.3, duration: 300, maxZoom: 0.9 });
    },
    [fitView],
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      draggedPositionsRef.current.set(node.id, node.position);
      setNodes((nds) =>
        nds.map((n) =>
          n.id === node.id ? { ...n, position: node.position } : n,
        ),
      );
    },
    [setNodes],
  );

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
      setSelectedNodeIds(new Set(selectedNodes.map((n) => n.id)));
    },
    [],
  );

  // --- Selection highlighting computed as derived state, NOT via effects ---

  // Build set of node IDs connected to selected nodes
  const connectedNodeIds = useMemo(() => {
    if (selectedNodeIds.size === 0) return new Set<string>();
    const ids = new Set<string>(selectedNodeIds);
    for (const e of edges) {
      if (selectedNodeIds.has(e.source) || selectedNodeIds.has(e.target)) {
        ids.add(e.source);
        ids.add(e.target);
      }
    }
    return ids;
  }, [selectedNodeIds, edges]);

  // Styled nodes: dim unrelated nodes when something is selected, highlight hovered target
  const displayNodes = useMemo(() => {
    const hasSelection = selectedNodeIds.size > 0;
    return nodes.map((n) => {
      const isHoverTarget = hoveredPointerId === n.id;
      const style: React.CSSProperties = { ...n.style };

      if (hasSelection) {
        style.opacity = connectedNodeIds.has(n.id) ? 1 : 0.25;
        style.transition = "opacity 0.2s ease, filter 0.2s ease";
      }

      if (isHoverTarget) {
        style.filter = "drop-shadow(0 0 8px rgba(59, 130, 246, 0.6))";
        style.transition = "filter 0.2s ease";
      }

      return { ...n, style };
    });
  }, [nodes, selectedNodeIds, connectedNodeIds, hoveredPointerId]);

  // Styled edges: highlight connected edges when something is selected
  const displayEdges = useMemo(() => {
    if (selectedNodeIds.size === 0) return edges;
    return edges.map((e) => {
      const isConnected =
        selectedNodeIds.has(e.source) || selectedNodeIds.has(e.target);
      return {
        ...e,
        style: {
          stroke: isConnected ? "#2563eb" : "#d1d5db",
          strokeWidth: isConnected ? 3.5 : 2,
          strokeDasharray: isConnected ? undefined : "6 3",
        },
        markerEnd: {
          type: "arrowclosed" as const,
          color: isConnected ? "#2563eb" : "#d1d5db",
          width: 16,
          height: 16,
        },
        animated: isConnected,
        zIndex: isConnected ? 10 : 0,
      };
    });
  }, [edges, selectedNodeIds]);

  return (
    <ReactFlow
      nodes={displayNodes}
      edges={displayEdges}
      onNodesChange={onNodesChange}
      onNodeDragStop={onNodeDragStop}
      nodeTypes={nodeTypes}
      fitView
      className="bg-gray-50"
      nodesDraggable={true}
      nodesConnectable={false}
      elementsSelectable={true}
      onSelectionChange={onSelectionChange}
      onPaneContextMenu={handlePaneContextMenu}
      deleteKeyCode={null}
      zoomOnDoubleClick={false}
      defaultEdgeOptions={{ type: "smoothstep" }}
    >
      <Background
        variant={BackgroundVariant.Lines}
        gap={20}
        size={1}
        color="#d1d5db"
      />
    </ReactFlow>
  );
}

interface ToggleButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  title: string;
  activeColor?: string;
}

function ToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
  title,
  activeColor = UI_COLORS.green,
}: ToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-heading border transition-all duration-200 ${
        active
          ? "border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
          : "border-black/20 hover:border-black/40"
      }`}
      style={{
        backgroundColor: active ? activeColor : "transparent",
        opacity: active ? 1 : 0.7,
      }}
    >
      <Icon size={11} />
      <span className={`hidden sm:inline ${active ? "font-semibold" : ""}`}>
        {label}
      </span>
      {active && (
        <span className="w-1.5 h-1.5 rounded-full bg-black ml-0.5" />
      )}
    </button>
  );
}

interface HeapCanvasProps {
  workspaceId: string;
}

const HeapCanvas = ({ workspaceId }: HeapCanvasProps) => {
  const { trace } = useVisualizerStore();
  
  // Load persisted toggle states from localStorage, per workspace
  const getStorageKey = (key: string) => `heap-${workspaceId}-${key}`;
  
  const [autoFit, setAutoFit] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(getStorageKey('autofit'));
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });
  
  const [autoReorder, setAutoReorder] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(getStorageKey('autoreorder'));
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });
  
  // Persist toggle states to localStorage, per workspace
  useEffect(() => {
    localStorage.setItem(getStorageKey('autofit'), JSON.stringify(autoFit));
  }, [autoFit, workspaceId]);
  
  useEffect(() => {
    localStorage.setItem(getStorageKey('autoreorder'), JSON.stringify(autoReorder));
  }, [autoReorder, workspaceId]);

  return (
    <div id="heap-canvas" className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-b-2 border-black flex-shrink-0"
        style={{ backgroundColor: UI_COLORS.cyan }}
      >
        <Database size={14} />
        <span className="font-heading text-xs">Heap</span>

        <div className="ml-auto flex items-center gap-2">
          <ToggleButton
            active={autoFit}
            onClick={() => setAutoFit((v) => !v)}
            icon={Maximize2}
            label="Auto Fit"
            title="Automatically fit the view to show all heap nodes when the heap changes"
            activeColor={UI_COLORS.green}
          />
          <ToggleButton
            active={autoReorder}
            onClick={() => setAutoReorder((v) => !v)}
            icon={LayoutGrid}
            label="Auto Layout"
            title="Automatically recompute node positions using smart layout algorithm"
            activeColor={UI_COLORS.blue}
          />
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        {!trace ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm font-base">
            Run code to see heap visualization
          </div>
        ) : (
          <ReactFlowProvider>
            <HeapCanvasInner
              autoFit={autoFit}
              autoReorder={autoReorder}
            />
          </ReactFlowProvider>
        )}
      </div>
    </div>
  );
};

export default HeapCanvas;
