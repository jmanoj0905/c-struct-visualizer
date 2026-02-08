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
import { Database } from "lucide-react";
import StructNode from "../StructNode";
import PointerNode from "../PointerNode";
import { useVisualizerStore } from "../../store/visualizerStore";
import { UI_COLORS } from "../../utils/colors";
import { computeLayout } from "../../utils/smartLayout";

const nodeTypes = {
  structNode: StructNode,
  pointerNode: PointerNode,
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

function HeapCanvasInner() {
  const { fitView } = useReactFlow();
  const { heapState } = useVisualizerStore();
  const [nodes, setNodes, onNodesChangeRaw] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(
    new Set(),
  );
  const draggedPositionsRef = useRef<
    Map<string, { x: number; y: number }>
  >(new Map());
  const prevNodeCountRef = useRef(0);

  // Filter out 'remove' changes — nodes are owned by heapState, not React Flow
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChangeRaw(changes.filter((c) => c.type !== "remove"));
    },
    [onNodesChangeRaw],
  );

  // Convert heapState to ReactFlow nodes and edges
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
        },
      };
    });

    // Position pointers above the struct they point to
    const targetPointerCount = new Map<string, number>();
    const pointerNodes: Node[] = heapState.pointerInstances.map((pi) => {
      let position: { x: number; y: number };
      if (pi.position.x !== 0 || pi.position.y !== 0) {
        position = pi.position;
      } else if (
        pi.targetInstanceId &&
        structPositions.has(pi.targetInstanceId)
      ) {
        const targetPos = structPositions.get(pi.targetInstanceId)!;
        const idx = targetPointerCount.get(pi.targetInstanceId) || 0;
        targetPointerCount.set(pi.targetInstanceId, idx + 1);
        position = { x: targetPos.x + idx * 180, y: targetPos.y - 120 };
      } else {
        const nullIdx = targetPointerCount.get("__null") || 0;
        targetPointerCount.set("__null", nullIdx + 1);
        position = { x: -200 + nullIdx * 180, y: 0 };
      }

      return {
        id: pi.id,
        type: "pointerNode",
        position,
        data: {
          pointerInstanceId: pi.id,
          name: pi.name,
          type: pi.type,
          pointerLevel: pi.pointerLevel,
          targetInstanceId: pi.targetInstanceId,
          targetFieldName: pi.targetFieldName,
          color: pi.color,
          readOnly: true,
        },
      };
    });

    // Struct-to-struct connections
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

    // Pointer connections (to structs or other pointers)
    const pointerEdges: Edge[] = heapState.pointerInstances
      .filter((pi) => pi.targetInstanceId)
      .map((pi) => {
        const targetIsPointer = heapState.pointerInstances.some(
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
          style: { ...DEFAULT_EDGE_STYLE },
          markerEnd: { ...DEFAULT_MARKER },
        };
      });

    return {
      rfNodes: [...structNodes, ...pointerNodes],
      rfEdges: [...structEdges, ...pointerEdges],
    };
  }, [heapState]);

  // Sync nodes/edges from heapState — the ONLY place that calls setNodes/setEdges
  useEffect(() => {
    const merged = rfNodes.map((n) => {
      const draggedPos = draggedPositionsRef.current.get(n.id);
      return draggedPos ? { ...n, position: draggedPos } : n;
    });
    setNodes(merged);
    setEdges(rfEdges);
    // Clear stale selection when stepping
    setSelectedNodeIds(new Set());

    // Auto fit-to-view when new nodes are added
    const nodeCount = rfNodes.length;
    if (nodeCount > 0 && nodeCount !== prevNodeCountRef.current) {
      // Small delay so React Flow has time to measure the new nodes
      setTimeout(() => fitView({ padding: 0.3, duration: 300, maxZoom: 0.9 }), 50);
    }
    prevNodeCountRef.current = nodeCount;
  }, [rfNodes, rfEdges, setNodes, setEdges, fitView]);

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

  // Styled nodes: dim unrelated nodes when something is selected
  const displayNodes = useMemo(() => {
    if (selectedNodeIds.size === 0) return nodes;
    return nodes.map((n) => ({
      ...n,
      style: {
        ...n.style,
        opacity: connectedNodeIds.has(n.id) ? 1 : 0.25,
        transition: "opacity 0.2s ease",
      },
    }));
  }, [nodes, selectedNodeIds, connectedNodeIds]);

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

const HeapCanvas = () => {
  const { trace } = useVisualizerStore();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-b-2 border-black flex-shrink-0"
        style={{ backgroundColor: UI_COLORS.cyan }}
      >
        <Database size={14} />
        <span className="font-heading text-xs">Heap</span>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        {!trace ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm font-base">
            Run code to see heap visualization
          </div>
        ) : (
          <ReactFlowProvider>
            <HeapCanvasInner />
          </ReactFlowProvider>
        )}
      </div>
    </div>
  );
};

export default HeapCanvas;
