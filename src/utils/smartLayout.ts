import type { StructInstance, PointerConnection, CStruct } from "../types";
import { analyzeGraph } from "./graphAnalysis";

/**
 * ============================================================================
 * SIMPLE LAYOUT SYSTEM
 * ============================================================================
 * Hierarchical for linear structures, circular for cycles
 * ============================================================================
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Data structure pattern types (minimal set)
 */
export const StructurePattern = {
  GRAPH_WITH_CYCLES: "GRAPH_WITH_CYCLES",
  HIERARCHICAL: "HIERARCHICAL",
} as const;

export type StructurePattern =
  (typeof StructurePattern)[keyof typeof StructurePattern];

/**
 * Component info with nodes
 */
interface ComponentInfo {
  pattern: StructurePattern;
  nodeIds: Set<string>;
  rootNodeId?: string;
  headNodeId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Layout configuration
 */
interface LayoutConfig {
  nodeWidth: number;
  nodeHeight: number;
  horizontalSpacing: number;
  verticalSpacing: number;
  circularRadius: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: LayoutConfig = {
  nodeWidth: 350,
  nodeHeight: 250,
  horizontalSpacing: 200,
  verticalSpacing: 150,
  circularRadius: 400,
};

// ============================================================================
// MAIN LAYOUT SYSTEM
// ============================================================================

/**
 * Simple layout: hierarchical for linear, circular for cycles
 */
export async function performSmartLayout(
  instances: StructInstance[],
  connections: PointerConnection[],
  structDefinitions: CStruct[],
  updateInstancePosition: (id: string, pos: { x: number; y: number }) => void,
): Promise<void> {
  if (instances.length === 0) return;

  try {
    // Find connected components
    const components = findPhysicsComponents(instances, connections);

    // Layout each component separately
    let globalOffsetX = 0;
    const componentGap = 600;

    for (const component of components) {
      const positions = layoutComponentSimple(
        component,
        instances,
        connections,
        structDefinitions,
      );

      // Apply positions with global offset
      positions.forEach((pos, nodeId) => {
        updateInstancePosition(nodeId, {
          x: pos.x + globalOffsetX,
          y: pos.y,
        });
      });

      // Calculate component width for next offset
      const componentWidth = calculateComponentWidth(positions);
      globalOffsetX += componentWidth + componentGap;
    }
  } catch (error) {
    console.error("Layout error:", error);
    throw error;
  }
}

/**
 * Find connected components
 */
function findPhysicsComponents(
  instances: StructInstance[],
  connections: PointerConnection[],
): Set<string>[] {
  const components: Set<string>[] = [];
  const visited = new Set<string>();

  // Build adjacency map
  const adjacencyMap = new Map<string, Set<string>>();
  instances.forEach((inst) => adjacencyMap.set(inst.id, new Set()));

  connections.forEach((conn) => {
    adjacencyMap.get(conn.sourceInstanceId)?.add(conn.targetInstanceId);
    adjacencyMap.get(conn.targetInstanceId)?.add(conn.sourceInstanceId);
  });

  // BFS to find components
  function bfs(startId: string): Set<string> {
    const component = new Set<string>();
    const queue = [startId];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;

      visited.add(nodeId);
      component.add(nodeId);

      const neighbors = adjacencyMap.get(nodeId) || new Set();
      neighbors.forEach((neighbor) => {
        if (!visited.has(neighbor)) queue.push(neighbor);
      });
    }

    return component;
  }

  // Find all components
  instances.forEach((inst) => {
    if (!visited.has(inst.id)) {
      const component = bfs(inst.id);
      if (component.size > 0) {
        components.push(component);
      }
    }
  });

  return components;
}

/**
 * Simple layout: hierarchical for linear structures, circular for cycles
 */
function layoutComponentSimple(
  nodeIds: Set<string>,
  instances: StructInstance[],
  connections: PointerConnection[],
  structDefinitions: CStruct[],
): Map<string, { x: number; y: number }> {
  const componentConnections = connections.filter(
    (c) => nodeIds.has(c.sourceInstanceId) && nodeIds.has(c.targetInstanceId),
  );

  // Check if component has cycles
  const graphMetrics = analyzeGraph(
    Array.from(nodeIds).map((id) => ({ id }) as StructInstance),
    componentConnections,
  );

  const hasCycles = graphMetrics.sccs.some((scc) => scc.ids.size > 1);

  // If no cycles: use horizontal hierarchy
  if (!hasCycles) {
    return layoutHierarchical(nodeIds, componentConnections);
  }

  // If cycles: use hybrid (cycles in circle, rest hierarchical)
  return layoutGraphWithCycles(
    { nodeIds, pattern: StructurePattern.GRAPH_WITH_CYCLES },
    instances,
    connections,
    structDefinitions,
    new Map(),
    DEFAULT_CONFIG,
  );
}

/**
 * Simple horizontal hierarchy layout (left-to-right)
 */
function layoutHierarchical(
  nodeIds: Set<string>,
  connections: PointerConnection[],
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const nodeArray = Array.from(nodeIds);

  // Assign depth to each node
  const nodeDepth = new Map<string, number>();

  function assignDepth(nodeId: string, depth: number) {
    if (nodeDepth.has(nodeId)) {
      const existingDepth = nodeDepth.get(nodeId)!;
      if (depth >= existingDepth) return; // Keep shallower depth
    }

    nodeDepth.set(nodeId, depth);

    const outgoing = connections.filter((c) => c.sourceInstanceId === nodeId);
    outgoing.forEach((conn) => {
      assignDepth(conn.targetInstanceId, depth + 1);
    });
  }

  // Find roots (nodes with no incoming edges)
  const nodesWithIncoming = new Set<string>();
  connections.forEach((c) => nodesWithIncoming.add(c.targetInstanceId));
  const roots = nodeArray.filter((id) => !nodesWithIncoming.has(id));

  // If no roots found (isolated nodes or all have incoming), start from first node
  if (roots.length === 0 && nodeArray.length > 0) {
    roots.push(nodeArray[0]);
  }

  // Assign depths from roots
  roots.forEach((root) => assignDepth(root, 0));

  // Nodes not reached from roots get depth 0
  nodeArray.forEach((id) => {
    if (!nodeDepth.has(id)) {
      nodeDepth.set(id, 0);
    }
  });

  // Group nodes by depth
  const layers: string[][] = [];
  const maxDepth = Math.max(...Array.from(nodeDepth.values()), 0);

  for (let i = 0; i <= maxDepth; i++) {
    layers.push([]);
  }

  nodeArray.forEach((id) => {
    const depth = nodeDepth.get(id)!;
    layers[depth].push(id);
  });

  // Position nodes
  const HORIZONTAL_SPACING = 550;
  const VERTICAL_SPACING = 200;
  const NODE_HEIGHT = 250;

  layers.forEach((layer, layerIndex) => {
    const x = layerIndex * HORIZONTAL_SPACING;
    const totalHeight = layer.length * NODE_HEIGHT + (layer.length - 1) * VERTICAL_SPACING;
    let y = -totalHeight / 2;

    layer.forEach((nodeId) => {
      positions.set(nodeId, { x, y });
      y += NODE_HEIGHT + VERTICAL_SPACING;
    });
  });

  return positions;
}

/**
 * Hybrid layout for graphs with cycles:
 * - Cycle nodes arranged in a circle
 * - Non-cycle nodes arranged hierarchically
 */
function layoutGraphWithCycles(
  component: ComponentInfo,
  _instances: StructInstance[],
  connections: PointerConnection[],
  _structDefinitions: CStruct[],
  _nodeHeights: Map<string, number>,
  config: LayoutConfig,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const componentConnections = connections.filter(
    (c) =>
      component.nodeIds.has(c.sourceInstanceId) &&
      component.nodeIds.has(c.targetInstanceId),
  );

  // Find all cycle nodes (nodes in SCCs with size > 1)
  const graphMetrics = analyzeGraph(
    Array.from(component.nodeIds).map((id) => ({ id }) as StructInstance),
    componentConnections,
  );

  const cycleNodes = new Set<string>();
  graphMetrics.sccs.forEach((scc) => {
    if (scc.ids.size > 1) {
      scc.ids.forEach((id) => cycleNodes.add(id));
    }
  });

  const nonCycleNodes = Array.from(component.nodeIds).filter(
    (id) => !cycleNodes.has(id),
  );

  // Layout cycle nodes in rhombus/diamond shape to prevent overlaps
  const cycleNodeArray = Array.from(cycleNodes);
  const cycleCount = cycleNodeArray.length;

  if (cycleCount > 0) {
    const cyclePositions = layoutCycleRhombus(cycleNodeArray, config);
    cyclePositions.forEach((pos, nodeId) => {
      positions.set(nodeId, pos);
    });
  }

  /**
   * Layout cycle nodes in rhombus/diamond shape
   * Natural spacing prevents arrow overlaps
   */
  function layoutCycleRhombus(
    nodes: string[],
    _config: LayoutConfig,
  ): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>();
    const n = nodes.length;

    if (n === 0) return positions;

    const SPACING = 600; // Base spacing between nodes
    const CENTER_X = 0;
    const CENTER_Y = 0;

    if (n === 1) {
      // Single node at center
      positions.set(nodes[0], { x: CENTER_X, y: CENTER_Y });
    } else if (n === 2) {
      // Two nodes: horizontal line
      positions.set(nodes[0], { x: CENTER_X - SPACING, y: CENTER_Y });
      positions.set(nodes[1], { x: CENTER_X + SPACING, y: CENTER_Y });
    } else if (n === 3) {
      // Triangle: top, bottom-left, bottom-right
      positions.set(nodes[0], { x: CENTER_X, y: CENTER_Y - SPACING });
      positions.set(nodes[1], { x: CENTER_X - SPACING, y: CENTER_Y + SPACING });
      positions.set(nodes[2], { x: CENTER_X + SPACING, y: CENTER_Y + SPACING });
    } else if (n === 4) {
      // Diamond: top, left, right, bottom
      positions.set(nodes[0], { x: CENTER_X, y: CENTER_Y - SPACING });
      positions.set(nodes[1], { x: CENTER_X - SPACING, y: CENTER_Y });
      positions.set(nodes[2], { x: CENTER_X + SPACING, y: CENTER_Y });
      positions.set(nodes[3], { x: CENTER_X, y: CENTER_Y + SPACING });
    } else {
      // Extended diamond for 5+ nodes
      // Distribute nodes across 4 sides: top, left, right, bottom
      const sides = {
        top: [] as string[],
        left: [] as string[],
        right: [] as string[],
        bottom: [] as string[],
      };

      // Distribute nodes evenly across sides
      const nodesPerSide = Math.ceil(n / 4);
      const remainder = n % 4;

      let idx = 0;
      // Top side (fewer if remainder)
      const topCount = nodesPerSide - (remainder === 3 ? 1 : 0);
      for (let i = 0; i < topCount && idx < n; i++, idx++) {
        sides.top.push(nodes[idx]);
      }
      // Right side
      const rightCount = nodesPerSide;
      for (let i = 0; i < rightCount && idx < n; i++, idx++) {
        sides.right.push(nodes[idx]);
      }
      // Bottom side
      const bottomCount = nodesPerSide;
      for (let i = 0; i < bottomCount && idx < n; i++, idx++) {
        sides.bottom.push(nodes[idx]);
      }
      // Left side (remaining)
      while (idx < n) {
        sides.left.push(nodes[idx++]);
      }

      // Position top nodes
      const topSpacing = SPACING * 1.5 / Math.max(1, sides.top.length - 1 || 1);
      sides.top.forEach((nodeId, i) => {
        const offset = (sides.top.length - 1) / 2;
        const x = CENTER_X + (i - offset) * topSpacing;
        positions.set(nodeId, { x, y: CENTER_Y - SPACING * 1.2 });
      });

      // Position right nodes
      const rightSpacing = SPACING * 2 / Math.max(1, sides.right.length + 1);
      sides.right.forEach((nodeId, i) => {
        const y = CENTER_Y - SPACING + (i + 1) * rightSpacing;
        positions.set(nodeId, { x: CENTER_X + SPACING * 1.2, y });
      });

      // Position bottom nodes
      const bottomSpacing = SPACING * 1.5 / Math.max(1, sides.bottom.length - 1 || 1);
      sides.bottom.forEach((nodeId, i) => {
        const offset = (sides.bottom.length - 1) / 2;
        const x = CENTER_X + (i - offset) * bottomSpacing;
        positions.set(nodeId, { x, y: CENTER_Y + SPACING * 1.2 });
      });

      // Position left nodes
      const leftSpacing = SPACING * 2 / Math.max(1, sides.left.length + 1);
      sides.left.forEach((nodeId, i) => {
        const y = CENTER_Y - SPACING + (i + 1) * leftSpacing;
        positions.set(nodeId, { x: CENTER_X - SPACING * 1.2, y });
      });
    }

    return positions;
  }

  // Layout non-cycle nodes hierarchically to the left
  if (nonCycleNodes.length > 0) {
    const visited = new Set<string>();
    const layers: string[][] = [];
    const nodeLayer = new Map<string, number>();

    function assignLayer(nodeId: string, layer: number) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const currentLayer = nodeLayer.get(nodeId) ?? layer;
      nodeLayer.set(nodeId, Math.min(currentLayer, layer));

      // Find children (non-cycle nodes)
      const children = componentConnections
        .filter(
          (c) =>
            c.sourceInstanceId === nodeId &&
            nonCycleNodes.includes(c.targetInstanceId),
        )
        .map((c) => c.targetInstanceId);

      children.forEach((childId) => assignLayer(childId, layer + 1));
    }

    // Find true roots (non-cycle nodes with no incoming from other non-cycle nodes)
    const nodesWithNonCycleIncoming = new Set<string>();
    componentConnections.forEach((c) => {
      if (
        nonCycleNodes.includes(c.sourceInstanceId) &&
        nonCycleNodes.includes(c.targetInstanceId)
      ) {
        nodesWithNonCycleIncoming.add(c.targetInstanceId);
      }
    });

    const trueRoots = nonCycleNodes.filter(
      (id) => !nodesWithNonCycleIncoming.has(id),
    );

    // Assign layers starting from roots
    trueRoots.forEach((root) => assignLayer(root, 0));

    // Group nodes by layer
    const maxLayer = Math.max(...Array.from(nodeLayer.values()), 0);
    for (let i = 0; i <= maxLayer; i++) {
      layers.push([]);
    }

    nonCycleNodes.forEach((id) => {
      const layer = nodeLayer.get(id) ?? 0;
      layers[layer].push(id);
    });

    // Position non-cycle nodes to the left of the cycle columns
    const cycleLeftEdge = cycleCount > 0 ? -600 : 0; // Fixed offset to left

    layers.forEach((layer, layerIndex) => {
      const x =
        cycleLeftEdge -
        layerIndex * (config.nodeWidth + config.horizontalSpacing);
      const totalHeight =
        layer.length * config.nodeHeight +
        (layer.length - 1) * config.verticalSpacing;
      let y = -totalHeight / 2;

      layer.forEach((nodeId) => {
        positions.set(nodeId, { x, y });
        y += config.nodeHeight + config.verticalSpacing;
      });
    });
  }

  return positions;
}

/**
 * Calculate component width from positions
 */
function calculateComponentWidth(
  positions: Map<string, { x: number; y: number }>,
): number {
  if (positions.size === 0) return 0;

  let minX = Infinity;
  let maxX = -Infinity;

  positions.forEach((pos) => {
    minX = Math.min(minX, pos.x);
    maxX = Math.max(maxX, pos.x);
  });

  return maxX - minX + 350;
}
