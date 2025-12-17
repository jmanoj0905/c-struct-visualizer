import type { StructInstance, PointerConnection, CStruct } from "../types";
import { analyzeGraph } from "./graphAnalysis";

/**
 * ============================================================================
 * FUTURE-PROOF MODULAR LAYOUT SYSTEM
 * ============================================================================
 *
 * This system is designed to be:
 * - Completely modular
 * - Easy to extend with new patterns
 * - Easy to add new layout strategies
 * - Testable and maintainable
 *
 * To add a new data structure pattern:
 * 1. Add pattern type to StructurePattern
 * 2. Create detector function in PATTERN_DETECTORS
 * 3. Create layout strategy in LAYOUT_STRATEGIES
 * 4. Register in getPatternDetectors() and getLayoutStrategies()
 *
 * ============================================================================
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Data structure pattern types
 */
export const StructurePattern = {
  // Trees
  BINARY_TREE: "BINARY_TREE",
  BINARY_SEARCH_TREE: "BINARY_SEARCH_TREE",
  AVL_TREE: "AVL_TREE",
  RED_BLACK_TREE: "RED_BLACK_TREE",
  B_TREE: "B_TREE",
  TRIE: "TRIE",
  HEAP: "HEAP",
  GENERAL_TREE: "GENERAL_TREE",

  // Lists
  SINGLY_LINKED_LIST: "SINGLY_LINKED_LIST",
  DOUBLY_LINKED_LIST: "DOUBLY_LINKED_LIST",
  CIRCULAR_LINKED_LIST: "CIRCULAR_LINKED_LIST",
  SKIP_LIST: "SKIP_LIST",

  // Graphs
  DIRECTED_ACYCLIC_GRAPH: "DIRECTED_ACYCLIC_GRAPH",
  UNDIRECTED_GRAPH: "UNDIRECTED_GRAPH",
  BIPARTITE_GRAPH: "BIPARTITE_GRAPH",
  GENERAL_GRAPH: "GENERAL_GRAPH",

  // Specialized
  HASH_TABLE_CHAINING: "HASH_TABLE_CHAINING",
  DISJOINT_SET_FOREST: "DISJOINT_SET_FOREST",
  GRID_2D: "GRID_2D",

  // Fallback
  ISOLATED_NODES: "ISOLATED_NODES",
  UNKNOWN: "UNKNOWN",
} as const;

export type StructurePattern =
  (typeof StructurePattern)[keyof typeof StructurePattern];

/**
 * Component classification with pattern and nodes
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

/**
 * Pattern detector result
 */
interface PatternDetectorResult {
  matches: boolean;
  confidence: number; // 0-1, higher = more confident
  metadata?: Record<string, unknown>;
}

/**
 * Pattern detector function type
 */
type PatternDetector = (
  nodeIds: Set<string>,
  connections: PointerConnection[],
  instances: StructInstance[],
  structDefinitions: CStruct[],
) => PatternDetectorResult;

/**
 * Layout strategy function type
 */
type LayoutStrategy = (
  component: ComponentInfo,
  instances: StructInstance[],
  connections: PointerConnection[],
  structDefinitions: CStruct[],
  nodeHeights: Map<string, number>,
  config: LayoutConfig,
) => Map<string, { x: number; y: number }>;

/**
 * Pattern registry entry
 */
interface PatternRegistry {
  pattern: StructurePattern;
  detector: PatternDetector;
  priority: number; // Higher priority checked first
  description: string;
}

/**
 * Layout strategy registry entry
 */
interface LayoutStrategyRegistry {
  pattern: StructurePattern;
  strategy: LayoutStrategy;
  description: string;
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
// PATTERN DETECTORS
// ============================================================================

/**
 * Detect binary tree (each node has at most 2 children)
 */
function detectBinaryTree(
  nodeIds: Set<string>,
  connections: PointerConnection[],
  _instances: StructInstance[],
  _structDefinitions: CStruct[],
): PatternDetectorResult {
  const componentConnections = connections.filter(
    (c) => nodeIds.has(c.sourceInstanceId) && nodeIds.has(c.targetInstanceId),
  );

  if (nodeIds.size === 0) return { matches: false, confidence: 0 };

  // Check if it's a tree
  if (componentConnections.length !== nodeIds.size - 1)
    return { matches: false, confidence: 0 };

  // Check each node has at most 2 children
  const outgoingCount = new Map<string, number>();
  componentConnections.forEach((conn) => {
    const count = outgoingCount.get(conn.sourceInstanceId) || 0;
    outgoingCount.set(conn.sourceInstanceId, count + 1);
  });

  for (const count of outgoingCount.values()) {
    if (count > 2) return { matches: false, confidence: 0 };
  }

  // Check for single root
  const nodesWithIncoming = new Set<string>();
  componentConnections.forEach((c) => nodesWithIncoming.add(c.targetInstanceId));
  const roots = Array.from(nodeIds).filter((id) => !nodesWithIncoming.has(id));

  if (roots.length !== 1) return { matches: false, confidence: 0 };

  return { matches: true, confidence: 0.9 };
}

/**
 * Detect general tree (N-ary tree, DAG with single root)
 */
function detectGeneralTree(
  nodeIds: Set<string>,
  connections: PointerConnection[],
  _instances: StructInstance[],
  _structDefinitions: CStruct[],
): PatternDetectorResult {
  if (nodeIds.size === 0) return { matches: false, confidence: 0 };

  const componentConnections = connections.filter(
    (c) => nodeIds.has(c.sourceInstanceId) && nodeIds.has(c.targetInstanceId),
  );

  // A tree with N nodes has exactly N-1 edges
  if (componentConnections.length !== nodeIds.size - 1)
    return { matches: false, confidence: 0 };

  // Check for exactly one root (node with no incoming edges)
  const nodesWithIncoming = new Set<string>();
  componentConnections.forEach((c) => nodesWithIncoming.add(c.targetInstanceId));

  const roots = Array.from(nodeIds).filter((id) => !nodesWithIncoming.has(id));
  if (roots.length !== 1) return { matches: false, confidence: 0 };

  // Each non-root node must have exactly 1 incoming edge
  const incomingCount = new Map<string, number>();
  componentConnections.forEach((c) => {
    const count = incomingCount.get(c.targetInstanceId) || 0;
    incomingCount.set(c.targetInstanceId, count + 1);
  });

  for (const nodeId of nodeIds) {
    if (nodeId === roots[0]) continue;
    if (incomingCount.get(nodeId) !== 1) return { matches: false, confidence: 0 };
  }

  return { matches: true, confidence: 0.8 };
}

/**
 * Detect singly linked list
 */
function detectSinglyLinkedList(
  nodeIds: Set<string>,
  connections: PointerConnection[],
  _instances: StructInstance[],
  _structDefinitions: CStruct[],
): PatternDetectorResult {
  if (nodeIds.size === 0) return { matches: false, confidence: 0 };

  const componentConnections = connections.filter(
    (c) => nodeIds.has(c.sourceInstanceId) && nodeIds.has(c.targetInstanceId),
  );

  // Each node has at most 1 outgoing edge
  const outgoingCount = new Map<string, number>();
  componentConnections.forEach((c) => {
    const count = outgoingCount.get(c.sourceInstanceId) || 0;
    outgoingCount.set(c.sourceInstanceId, count + 1);
  });

  for (const count of outgoingCount.values()) {
    if (count > 1) return { matches: false, confidence: 0 };
  }

  // Should have exactly one head
  const nodesWithIncoming = new Set<string>();
  componentConnections.forEach((c) => nodesWithIncoming.add(c.targetInstanceId));
  const heads = Array.from(nodeIds).filter((id) => !nodesWithIncoming.has(id));

  if (heads.length !== 1) return { matches: false, confidence: 0 };
  if (componentConnections.length !== nodeIds.size - 1)
    return { matches: false, confidence: 0 };

  return { matches: true, confidence: 0.95 };
}

/**
 * Detect doubly linked list
 */
function detectDoublyLinkedList(
  nodeIds: Set<string>,
  connections: PointerConnection[],
  _instances: StructInstance[],
  _structDefinitions: CStruct[],
): PatternDetectorResult {
  if (nodeIds.size < 2) return { matches: false, confidence: 0 };

  const componentConnections = connections.filter(
    (c) => nodeIds.has(c.sourceInstanceId) && nodeIds.has(c.targetInstanceId),
  );

  // Count bidirectional edges
  let bidirectionalCount = 0;
  const edgeSet = new Set<string>();

  componentConnections.forEach((c) => {
    const forward = `${c.sourceInstanceId}->${c.targetInstanceId}`;
    const reverse = `${c.targetInstanceId}->${c.sourceInstanceId}`;
    edgeSet.add(forward);

    if (edgeSet.has(reverse)) {
      bidirectionalCount++;
    }
  });

  const totalEdges = componentConnections.length;
  const bidirectionalRatio = bidirectionalCount / totalEdges;

  // At least 70% of edges should be bidirectional
  if (bidirectionalRatio < 0.7) return { matches: false, confidence: 0 };

  return { matches: true, confidence: bidirectionalRatio };
}

/**
 * Detect skip list (multi-level linked list)
 */
function detectSkipList(
  nodeIds: Set<string>,
  connections: PointerConnection[],
  instances: StructInstance[],
  structDefinitions: CStruct[],
): PatternDetectorResult {
  if (nodeIds.size < 3) return { matches: false, confidence: 0 };

  // Check if nodes have "level" or "height" field
  let hasLevelField = false;
  for (const nodeId of nodeIds) {
    const instance = instances.find((i) => i.id === nodeId);
    if (!instance) continue;

    const structDef = structDefinitions.find((s) => s.name === instance.structName);
    if (!structDef) continue;

    const hasLevel = structDef.fields.some(
      (f) => f.name === "level" || f.name === "height",
    );
    if (hasLevel) {
      hasLevelField = true;
      break;
    }
  }

  // Skip lists typically have multiple pointers (forward array)
  const componentConnections = connections.filter(
    (c) => nodeIds.has(c.sourceInstanceId) && nodeIds.has(c.targetInstanceId),
  );

  const outgoingCount = new Map<string, number>();
  componentConnections.forEach((c) => {
    const count = outgoingCount.get(c.sourceInstanceId) || 0;
    outgoingCount.set(c.sourceInstanceId, count + 1);
  });

  const avgOutgoing =
    Array.from(outgoingCount.values()).reduce((a, b) => a + b, 0) /
    outgoingCount.size;

  // Skip list nodes typically have multiple forward pointers
  const isMultiLevel = avgOutgoing > 1.5;

  if (hasLevelField && isMultiLevel) {
    return { matches: true, confidence: 0.85 };
  }

  return { matches: false, confidence: 0 };
}

/**
 * Detect heap (binary tree with specific parent-child relationships)
 */
function detectHeap(
  nodeIds: Set<string>,
  connections: PointerConnection[],
  instances: StructInstance[],
  _structDefinitions: CStruct[],
): PatternDetectorResult {
  const binaryTree = detectBinaryTree(nodeIds, connections, instances, _structDefinitions);
  if (!binaryTree.matches) return { matches: false, confidence: 0 };

  // Heaps are typically stored in arrays, but if represented as pointers,
  // we can check for completeness (all levels filled except possibly last)
  // For now, return lower confidence for heap (hard to detect without values)
  return { matches: true, confidence: 0.5, metadata: { type: "possible_heap" } };
}

/**
 * Detect directed acyclic graph (DAG)
 */
function detectDAG(
  nodeIds: Set<string>,
  connections: PointerConnection[],
  _instances: StructInstance[],
  _structDefinitions: CStruct[],
): PatternDetectorResult {
  if (nodeIds.size === 0) return { matches: false, confidence: 0 };

  const componentConnections = connections.filter(
    (c) => nodeIds.has(c.sourceInstanceId) && nodeIds.has(c.targetInstanceId),
  );

  // Use graph analysis to check for cycles
  const graphMetrics = analyzeGraph(
    Array.from(nodeIds).map((id) => ({ id } as StructInstance)),
    componentConnections,
  );

  // DAG = no cycles (no SCCs with size > 1)
  const hasCycles = graphMetrics.sccs.some((scc) => scc.ids.size > 1);
  if (hasCycles) return { matches: false, confidence: 0 };

  // DAG but not a tree (multiple roots or more edges than tree)
  const isTree = componentConnections.length === nodeIds.size - 1;
  if (isTree) return { matches: false, confidence: 0 };

  return { matches: true, confidence: 0.85 };
}

/**
 * Detect hash table with chaining (array of linked lists)
 */
function detectHashTableChaining(
  nodeIds: Set<string>,
  _connections: PointerConnection[],
  instances: StructInstance[],
  structDefinitions: CStruct[],
): PatternDetectorResult {
  if (nodeIds.size < 3) return { matches: false, confidence: 0 };

  // Look for a "buckets" or "table" array field
  let hasBucketsArray = false;
  for (const nodeId of nodeIds) {
    const instance = instances.find((i) => i.id === nodeId);
    if (!instance) continue;

    const structDef = structDefinitions.find((s) => s.name === instance.structName);
    if (!structDef) continue;

    const hasArray = structDef.fields.some(
      (f) =>
        f.isArray &&
        f.isPointer &&
        (f.name === "buckets" || f.name === "table" || f.name === "chains"),
    );

    if (hasArray) {
      hasBucketsArray = true;
      break;
    }
  }

  if (!hasBucketsArray) return { matches: false, confidence: 0 };

  return { matches: true, confidence: 0.8 };
}

/**
 * Detect grid/2D matrix structure
 */
function detectGrid2D(
  nodeIds: Set<string>,
  _connections: PointerConnection[],
  instances: StructInstance[],
  structDefinitions: CStruct[],
): PatternDetectorResult {
  if (nodeIds.size < 4) return { matches: false, confidence: 0 };

  // Check for row/col fields or up/down/left/right pointers
  let hasGridPointers = false;
  for (const nodeId of nodeIds) {
    const instance = instances.find((i) => i.id === nodeId);
    if (!instance) continue;

    const structDef = structDefinitions.find((s) => s.name === instance.structName);
    if (!structDef) continue;

    const pointerFields = structDef.fields.filter((f) => f.isPointer).map((f) => f.name);
    const hasDirectional =
      pointerFields.includes("up") &&
      pointerFields.includes("down") &&
      pointerFields.includes("left") &&
      pointerFields.includes("right");

    if (hasDirectional) {
      hasGridPointers = true;
      break;
    }
  }

  if (!hasGridPointers) return { matches: false, confidence: 0 };

  return { matches: true, confidence: 0.85 };
}

// ============================================================================
// LAYOUT STRATEGIES
// ============================================================================

/**
 * Horizontal tree layout (left-to-right)
 */
function layoutHorizontalTree(
  component: ComponentInfo,
  instances: StructInstance[],
  connections: PointerConnection[],
  structDefinitions: CStruct[],
  nodeHeights: Map<string, number>,
  config: LayoutConfig,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const rootId = component.rootNodeId || Array.from(component.nodeIds)[0];

  // Build adjacency list for children with connection metadata
  const childrenMap = new Map<string, Array<{ childId: string; fieldName: string }>>();
  connections.forEach((conn) => {
    if (
      component.nodeIds.has(conn.sourceInstanceId) &&
      component.nodeIds.has(conn.targetInstanceId)
    ) {
      const children = childrenMap.get(conn.sourceInstanceId) || [];
      children.push({
        childId: conn.targetInstanceId,
        fieldName: conn.sourceFieldName,
      });
      childrenMap.set(conn.sourceInstanceId, children);
    }
  });

  // Helper to get field index for ordering
  function getFieldIndex(nodeId: string, fieldName: string): number {
    const instance = instances.find((i) => i.id === nodeId);
    if (!instance) return 999;

    const structDef = structDefinitions.find((s) => s.name === instance.structName);
    if (!structDef) return 999;

    const baseFieldName = fieldName.split("[")[0];
    const fieldIndex = structDef.fields.findIndex((f) => f.name === baseFieldName);

    if (fieldIndex === -1) return 999;

    if (fieldName.includes("[")) {
      const arrayIndex = parseInt(fieldName.match(/\[(\d+)\]/)?.[1] || "0", 10);
      return fieldIndex * 1000 + arrayIndex;
    }

    return fieldIndex * 1000;
  }

  // Sort children by field position
  childrenMap.forEach((children, parentId) => {
    children.sort((a, b) => {
      const indexA = getFieldIndex(parentId, a.fieldName);
      const indexB = getFieldIndex(parentId, b.fieldName);
      return indexA - indexB;
    });
  });

  // Calculate subtree heights
  const nodeHeightsExtent = new Map<string, number>();

  function calculateSubtreeHeight(nodeId: string): number {
    const children = childrenMap.get(nodeId) || [];
    if (children.length === 0) {
      const height = nodeHeights.get(nodeId) || config.nodeHeight;
      nodeHeightsExtent.set(nodeId, height);
      return height;
    }

    const childrenHeight = children.reduce(
      (sum, child) => sum + calculateSubtreeHeight(child.childId),
      0,
    );
    const totalHeight = Math.max(
      childrenHeight + (children.length - 1) * config.verticalSpacing,
      nodeHeights.get(nodeId) || config.nodeHeight,
    );
    nodeHeightsExtent.set(nodeId, totalHeight);
    return totalHeight;
  }

  calculateSubtreeHeight(rootId);

  // Position nodes left-to-right
  function positionNode(
    nodeId: string,
    x: number,
    y: number,
    availableHeight: number,
  ) {
    const nodeHeight = nodeHeights.get(nodeId) || config.nodeHeight;
    const nodeY = y + availableHeight / 2 - nodeHeight / 2;
    positions.set(nodeId, { x, y: nodeY });

    const children = childrenMap.get(nodeId) || [];
    if (children.length === 0) return;

    const childX = x + config.nodeWidth + config.horizontalSpacing;

    let currentY = y;
    children.forEach((child) => {
      const childHeight = nodeHeightsExtent.get(child.childId) || config.nodeHeight;
      positionNode(child.childId, childX, currentY, childHeight);
      currentY += childHeight + config.verticalSpacing;
    });
  }

  const rootHeight = nodeHeightsExtent.get(rootId) || config.nodeHeight;
  positionNode(rootId, 0, 0, rootHeight);

  return positions;
}

/**
 * Horizontal linear list layout
 */
function layoutHorizontalList(
  component: ComponentInfo,
  _instances: StructInstance[],
  connections: PointerConnection[],
  _structDefinitions: CStruct[],
  _nodeHeights: Map<string, number>,
  config: LayoutConfig,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const headId = component.headNodeId || Array.from(component.nodeIds)[0];

  const nextMap = new Map<string, string>();
  connections.forEach((conn) => {
    if (
      component.nodeIds.has(conn.sourceInstanceId) &&
      component.nodeIds.has(conn.targetInstanceId)
    ) {
      nextMap.set(conn.sourceInstanceId, conn.targetInstanceId);
    }
  });

  let currentId: string | undefined = headId;
  let x = 0;
  const y = 0;

  const visited = new Set<string>();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    positions.set(currentId, { x, y });

    x += config.nodeWidth + config.horizontalSpacing;
    currentId = nextMap.get(currentId);
  }

  return positions;
}

/**
 * Circular/radial layout
 */
function layoutCircular(
  component: ComponentInfo,
  _instances: StructInstance[],
  _connections: PointerConnection[],
  _structDefinitions: CStruct[],
  _nodeHeights: Map<string, number>,
  config: LayoutConfig,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const nodeIds = Array.from(component.nodeIds);
  const nodeCount = nodeIds.length;

  if (nodeCount === 1) {
    positions.set(nodeIds[0], { x: 0, y: 0 });
    return positions;
  }

  const baseRadius = config.circularRadius;
  const radiusPerNode = 150;
  const radius = Math.max(baseRadius, nodeCount * radiusPerNode);

  const angleStep = (2 * Math.PI) / nodeCount;

  nodeIds.forEach((id, index) => {
    const angle = -Math.PI / 2 + index * angleStep;
    positions.set(id, {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    });
  });

  return positions;
}

/**
 * Layered DAG layout (topological ordering)
 */
function layoutLayeredDAG(
  component: ComponentInfo,
  _instances: StructInstance[],
  connections: PointerConnection[],
  _structDefinitions: CStruct[],
  _nodeHeights: Map<string, number>,
  config: LayoutConfig,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const nodeIds = Array.from(component.nodeIds);

  const componentConnections = connections.filter(
    (c) => component.nodeIds.has(c.sourceInstanceId) && component.nodeIds.has(c.targetInstanceId),
  );

  // Topological sort using DFS
  const visited = new Set<string>();
  const layers: string[][] = [];
  const nodeLayer = new Map<string, number>();

  function getMaxDepth(nodeId: string, depth: number): number {
    if (visited.has(nodeId)) return nodeLayer.get(nodeId) || depth;

    visited.add(nodeId);
    const outgoing = componentConnections.filter((c) => c.sourceInstanceId === nodeId);

    if (outgoing.length === 0) {
      nodeLayer.set(nodeId, depth);
      return depth;
    }

    let maxChildDepth = depth;
    outgoing.forEach((conn) => {
      const childDepth = getMaxDepth(conn.targetInstanceId, depth + 1);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    });

    nodeLayer.set(nodeId, maxChildDepth);
    return maxChildDepth;
  }

  // Find roots (nodes with no incoming edges)
  const nodesWithIncoming = new Set<string>();
  componentConnections.forEach((c) => nodesWithIncoming.add(c.targetInstanceId));
  const roots = nodeIds.filter((id) => !nodesWithIncoming.has(id));

  // Calculate layers from roots
  roots.forEach((root) => getMaxDepth(root, 0));

  // Group nodes by layer
  const maxLayer = Math.max(...Array.from(nodeLayer.values()), 0);
  for (let i = 0; i <= maxLayer; i++) {
    layers.push([]);
  }

  nodeIds.forEach((id) => {
    const layer = nodeLayer.get(id) ?? 0;
    layers[layer].push(id);
  });

  // Position nodes
  layers.forEach((layer, layerIndex) => {
    const x = layerIndex * (config.nodeWidth + config.horizontalSpacing);
    const totalHeight = layer.length * config.nodeHeight + (layer.length - 1) * config.verticalSpacing;
    let y = -totalHeight / 2;

    layer.forEach((nodeId) => {
      positions.set(nodeId, { x, y });
      y += config.nodeHeight + config.verticalSpacing;
    });
  });

  return positions;
}

/**
 * Force-directed graph layout with horizontal bias
 */
function layoutForceDirected(
  component: ComponentInfo,
  _instances: StructInstance[],
  connections: PointerConnection[],
  _structDefinitions: CStruct[],
  _nodeHeights: Map<string, number>,
  _config: LayoutConfig,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const nodeIds = Array.from(component.nodeIds);

  // Initialize positions with horizontal bias
  nodeIds.forEach((id, index) => {
    const angle = (index / nodeIds.length) * 2 * Math.PI;
    const horizontalRadius = 500;
    const verticalRadius = 300;
    positions.set(id, {
      x: horizontalRadius * Math.cos(angle),
      y: verticalRadius * Math.sin(angle),
    });
  });

  const iterations = 100;
  const k = Math.sqrt((1500 * 800) / nodeIds.length);

  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map<string, { fx: number; fy: number }>();

    nodeIds.forEach((id) => forces.set(id, { fx: 0, fy: 0 }));

    // Repulsive forces
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const id1 = nodeIds[i];
        const id2 = nodeIds[j];
        const pos1 = positions.get(id1)!;
        const pos2 = positions.get(id2)!;

        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        const repulsiveForce = (k * k) / distance;
        const fx = (dx / distance) * repulsiveForce;
        const fy = (dy / distance) * repulsiveForce;

        const force1 = forces.get(id1)!;
        const force2 = forces.get(id2)!;
        force1.fx += fx;
        force1.fy += fy;
        force2.fx -= fx;
        force2.fy -= fy;
      }
    }

    // Attractive forces
    connections.forEach((conn) => {
      if (
        !component.nodeIds.has(conn.sourceInstanceId) ||
        !component.nodeIds.has(conn.targetInstanceId)
      )
        return;

      const pos1 = positions.get(conn.sourceInstanceId)!;
      const pos2 = positions.get(conn.targetInstanceId)!;

      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;

      const attractiveForce = (distance * distance) / k;
      const fx = (dx / distance) * attractiveForce;
      const fy = (dy / distance) * attractiveForce;

      const force1 = forces.get(conn.sourceInstanceId)!;
      const force2 = forces.get(conn.targetInstanceId)!;
      force1.fx += fx;
      force1.fy += fy;
      force2.fx -= fx;
      force2.fy -= fy;
    });

    // Apply forces with horizontal bias
    const temperature = 50 * (1 - iter / iterations);
    const horizontalBias = 1.3;
    const verticalBias = 0.7;

    nodeIds.forEach((id) => {
      const force = forces.get(id)!;
      const pos = positions.get(id)!;

      const biasedFx = force.fx * horizontalBias;
      const biasedFy = force.fy * verticalBias;

      const displacement = Math.sqrt(biasedFx * biasedFx + biasedFy * biasedFy) || 1;
      const limitedDisplacement = Math.min(displacement, temperature);

      pos.x += (biasedFx / displacement) * limitedDisplacement;
      pos.y += (biasedFy / displacement) * limitedDisplacement;
    });
  }

  return positions;
}

/**
 * Grid layout for 2D structures
 */
function layoutGrid2D(
  component: ComponentInfo,
  _instances: StructInstance[],
  _connections: PointerConnection[],
  _structDefinitions: CStruct[],
  _nodeHeights: Map<string, number>,
  config: LayoutConfig,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const nodeIds = Array.from(component.nodeIds);

  // Try to infer grid dimensions
  const gridSize = Math.ceil(Math.sqrt(nodeIds.length));

  nodeIds.forEach((id, index) => {
    const row = Math.floor(index / gridSize);
    const col = index % gridSize;

    positions.set(id, {
      x: col * (config.nodeWidth + config.horizontalSpacing),
      y: row * (config.nodeHeight + config.verticalSpacing),
    });
  });

  return positions;
}

/**
 * Multi-level layout for skip lists
 */
function layoutSkipList(
  component: ComponentInfo,
  instances: StructInstance[],
  _connections: PointerConnection[],
  _structDefinitions: CStruct[],
  _nodeHeights: Map<string, number>,
  config: LayoutConfig,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const nodeIds = Array.from(component.nodeIds);

  // Group nodes by level (if available)
  const levels = new Map<number, string[]>();

  nodeIds.forEach((id) => {
    const instance = instances.find((i) => i.id === id);
    const level = (instance?.fieldValues?.level as number) || 0;

    if (!levels.has(level)) {
      levels.set(level, []);
    }
    levels.get(level)!.push(id);
  });

  // Position nodes level by level
  const sortedLevels = Array.from(levels.keys()).sort((a, b) => b - a);

  sortedLevels.forEach((level, levelIndex) => {
    const nodesInLevel = levels.get(level)!;
    const y = levelIndex * (config.nodeHeight + config.verticalSpacing);

    nodesInLevel.forEach((id, index) => {
      positions.set(id, {
        x: index * (config.nodeWidth + config.horizontalSpacing),
        y,
      });
    });
  });

  return positions;
}

/**
 * Simple grid layout for isolated nodes
 */
function layoutIsolatedNodes(
  component: ComponentInfo,
  _instances: StructInstance[],
  _connections: PointerConnection[],
  _structDefinitions: CStruct[],
  _nodeHeights: Map<string, number>,
  config: LayoutConfig,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const nodeIds = Array.from(component.nodeIds);

  const nodesPerRow = 4;
  nodeIds.forEach((id, index) => {
    const row = Math.floor(index / nodesPerRow);
    const col = index % nodesPerRow;

    const x = col * (config.nodeWidth + config.horizontalSpacing);
    const y = row * (config.nodeHeight + config.verticalSpacing);

    positions.set(id, { x, y });
  });

  return positions;
}

// ============================================================================
// REGISTRY SYSTEM
// ============================================================================

/**
 * Get all registered pattern detectors (ordered by priority)
 */
function getPatternDetectors(): PatternRegistry[] {
  return [
    // High specificity patterns first
    {
      pattern: StructurePattern.BINARY_TREE,
      detector: detectBinaryTree,
      priority: 90,
      description: "Binary tree with at most 2 children per node",
    },
    {
      pattern: StructurePattern.SINGLY_LINKED_LIST,
      detector: detectSinglyLinkedList,
      priority: 95,
      description: "Singly linked list with single forward pointer",
    },
    {
      pattern: StructurePattern.DOUBLY_LINKED_LIST,
      detector: detectDoublyLinkedList,
      priority: 85,
      description: "Doubly linked list with bidirectional pointers",
    },
    {
      pattern: StructurePattern.SKIP_LIST,
      detector: detectSkipList,
      priority: 80,
      description: "Skip list with multiple levels",
    },
    {
      pattern: StructurePattern.HEAP,
      detector: detectHeap,
      priority: 70,
      description: "Binary heap structure",
    },
    {
      pattern: StructurePattern.HASH_TABLE_CHAINING,
      detector: detectHashTableChaining,
      priority: 75,
      description: "Hash table with chaining (array of lists)",
    },
    {
      pattern: StructurePattern.GRID_2D,
      detector: detectGrid2D,
      priority: 78,
      description: "2D grid with directional pointers",
    },
    {
      pattern: StructurePattern.DIRECTED_ACYCLIC_GRAPH,
      detector: detectDAG,
      priority: 65,
      description: "Directed acyclic graph (DAG)",
    },
    {
      pattern: StructurePattern.GENERAL_TREE,
      detector: detectGeneralTree,
      priority: 60,
      description: "General tree (N-ary tree)",
    },
  ];
}

/**
 * Get all registered layout strategies
 */
function getLayoutStrategies(): LayoutStrategyRegistry[] {
  return [
    {
      pattern: StructurePattern.BINARY_TREE,
      strategy: layoutHorizontalTree,
      description: "Horizontal left-to-right tree layout",
    },
    {
      pattern: StructurePattern.GENERAL_TREE,
      strategy: layoutHorizontalTree,
      description: "Horizontal left-to-right tree layout",
    },
    {
      pattern: StructurePattern.SINGLY_LINKED_LIST,
      strategy: layoutHorizontalList,
      description: "Horizontal linear list layout",
    },
    {
      pattern: StructurePattern.DOUBLY_LINKED_LIST,
      strategy: layoutHorizontalList,
      description: "Horizontal linear list layout",
    },
    {
      pattern: StructurePattern.CIRCULAR_LINKED_LIST,
      strategy: layoutCircular,
      description: "Circular/radial layout",
    },
    {
      pattern: StructurePattern.SKIP_LIST,
      strategy: layoutSkipList,
      description: "Multi-level skip list layout",
    },
    {
      pattern: StructurePattern.HEAP,
      strategy: layoutHorizontalTree,
      description: "Horizontal tree layout for heap",
    },
    {
      pattern: StructurePattern.DIRECTED_ACYCLIC_GRAPH,
      strategy: layoutLayeredDAG,
      description: "Layered topological layout for DAGs",
    },
    {
      pattern: StructurePattern.HASH_TABLE_CHAINING,
      strategy: layoutGrid2D,
      description: "Grid layout for hash table buckets",
    },
    {
      pattern: StructurePattern.GRID_2D,
      strategy: layoutGrid2D,
      description: "2D grid layout",
    },
    {
      pattern: StructurePattern.GENERAL_GRAPH,
      strategy: layoutForceDirected,
      description: "Force-directed layout for general graphs",
    },
    {
      pattern: StructurePattern.ISOLATED_NODES,
      strategy: layoutIsolatedNodes,
      description: "Simple grid for isolated nodes",
    },
  ];
}

// ============================================================================
// MAIN LAYOUT SYSTEM
// ============================================================================

/**
 * Smart layout system that identifies patterns and applies appropriate layouts
 */
export async function performSmartLayout(
  instances: StructInstance[],
  connections: PointerConnection[],
  structDefinitions: CStruct[],
  updateInstancePosition: (id: string, pos: { x: number; y: number }) => void,
): Promise<void> {
  if (instances.length === 0) return;

  try {
    // Analyze graph structure
    const graphMetrics = analyzeGraph(instances, connections);

    // Classify components by pattern
    const components = classifyComponents(
      instances,
      connections,
      structDefinitions,
      graphMetrics,
    );

    // Calculate dynamic node heights
    const nodeHeights = calculateNodeHeights(instances, structDefinitions);

    // Layout each component
    let globalOffsetX = 0;
    const componentGap = 500;

    for (const component of components) {
      const positions = layoutComponent(
        component,
        instances,
        connections,
        structDefinitions,
        nodeHeights,
        DEFAULT_CONFIG,
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
    console.error("Smart layout error:", error);
    throw error;
  }
}

/**
 * Classify connected components by their structural pattern
 */
function classifyComponents(
  instances: StructInstance[],
  connections: PointerConnection[],
  structDefinitions: CStruct[],
  graphMetrics: ReturnType<typeof analyzeGraph>,
): ComponentInfo[] {
  const components: ComponentInfo[] = [];
  const processedNodes = new Set<string>();

  // Handle circular patterns (SCCs) first
  for (const scc of graphMetrics.sccs) {
    if (scc.ids.size === 1) {
      const nodeId = Array.from(scc.ids)[0];
      const isSelfLoop = connections.some(
        (c) => c.sourceInstanceId === nodeId && c.targetInstanceId === nodeId,
      );
      if (!isSelfLoop) continue;
    }

    components.push({
      pattern: StructurePattern.CIRCULAR_LINKED_LIST,
      nodeIds: scc.ids,
    });

    scc.ids.forEach((id) => processedNodes.add(id));
  }

  // Find connected components (acyclic)
  const adjacencyMap = buildAdjacencyMap(instances, connections);
  const allConnectedNodes = new Set<string>();
  connections.forEach((conn) => {
    allConnectedNodes.add(conn.sourceInstanceId);
    allConnectedNodes.add(conn.targetInstanceId);
  });

  // Process acyclic connected components
  for (const nodeId of allConnectedNodes) {
    if (processedNodes.has(nodeId)) continue;

    const componentNodes = findConnectedComponent(nodeId, adjacencyMap, processedNodes);
    if (componentNodes.size === 0) continue;

    // Detect pattern using registry
    const pattern = detectPattern(componentNodes, connections, instances, structDefinitions);
    const rootNode = findRootNode(componentNodes, connections);

    components.push({
      pattern,
      nodeIds: componentNodes,
      rootNodeId: rootNode,
      headNodeId: rootNode,
    });

    componentNodes.forEach((id) => processedNodes.add(id));
  }

  // Handle isolated nodes
  const isolatedNodes = instances
    .filter((inst) => !processedNodes.has(inst.id))
    .map((inst) => inst.id);

  if (isolatedNodes.length > 0) {
    components.push({
      pattern: StructurePattern.ISOLATED_NODES,
      nodeIds: new Set(isolatedNodes),
    });
  }

  return components;
}

/**
 * Detect pattern using registered detectors
 */
function detectPattern(
  nodeIds: Set<string>,
  connections: PointerConnection[],
  instances: StructInstance[],
  structDefinitions: CStruct[],
): StructurePattern {
  const detectors = getPatternDetectors();

  // Sort by priority (highest first)
  detectors.sort((a, b) => b.priority - a.priority);

  // Try each detector
  for (const { pattern, detector } of detectors) {
    const result = detector(nodeIds, connections, instances, structDefinitions);
    if (result.matches && result.confidence > 0.5) {
      return pattern;
    }
  }

  // Default to general graph
  return StructurePattern.GENERAL_GRAPH;
}

/**
 * Layout a component using registered strategy
 */
function layoutComponent(
  component: ComponentInfo,
  instances: StructInstance[],
  connections: PointerConnection[],
  structDefinitions: CStruct[],
  nodeHeights: Map<string, number>,
  config: LayoutConfig,
): Map<string, { x: number; y: number }> {
  const strategies = getLayoutStrategies();

  // Find strategy for this pattern
  const strategyEntry = strategies.find((s) => s.pattern === component.pattern);

  if (strategyEntry) {
    return strategyEntry.strategy(
      component,
      instances,
      connections,
      structDefinitions,
      nodeHeights,
      config,
    );
  }

  // Fallback to force-directed for unknown patterns
  return layoutForceDirected(
    component,
    instances,
    connections,
    structDefinitions,
    nodeHeights,
    config,
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Find the root node of a component
 */
function findRootNode(
  nodeIds: Set<string>,
  connections: PointerConnection[],
): string | undefined {
  if (nodeIds.size === 0) return undefined;

  const nodesWithIncoming = new Set<string>();
  connections.forEach((conn) => {
    if (nodeIds.has(conn.targetInstanceId)) {
      nodesWithIncoming.add(conn.targetInstanceId);
    }
  });

  const rootCandidates = Array.from(nodeIds).filter(
    (id) => !nodesWithIncoming.has(id),
  );

  return rootCandidates.length > 0 ? rootCandidates[0] : Array.from(nodeIds)[0];
}

/**
 * Build bidirectional adjacency map
 */
function buildAdjacencyMap(
  instances: StructInstance[],
  connections: PointerConnection[],
): Map<string, Set<string>> {
  const adjacencyMap = new Map<string, Set<string>>();

  instances.forEach((inst) => {
    adjacencyMap.set(inst.id, new Set());
  });

  connections.forEach((conn) => {
    const sourceSet = adjacencyMap.get(conn.sourceInstanceId);
    const targetSet = adjacencyMap.get(conn.targetInstanceId);

    if (sourceSet) sourceSet.add(conn.targetInstanceId);
    if (targetSet) targetSet.add(conn.sourceInstanceId);
  });

  return adjacencyMap;
}

/**
 * Find connected component using BFS
 */
function findConnectedComponent(
  startNodeId: string,
  adjacencyMap: Map<string, Set<string>>,
  excludeNodes: Set<string>,
): Set<string> {
  const component = new Set<string>();
  const queue = [startNodeId];
  const visited = new Set<string>(excludeNodes);

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;

    visited.add(nodeId);
    component.add(nodeId);

    const neighbors = adjacencyMap.get(nodeId) || new Set();
    neighbors.forEach((neighbor) => {
      if (!visited.has(neighbor)) {
        queue.push(neighbor);
      }
    });
  }

  return component;
}

/**
 * Calculate node heights based on field count
 */
function calculateNodeHeights(
  instances: StructInstance[],
  structDefinitions: CStruct[],
): Map<string, number> {
  const heights = new Map<string, number>();

  instances.forEach((inst) => {
    const structDef = structDefinitions.find((s) => s.name === inst.structName);
    const fieldCount = structDef?.fields.length || 0;

    const baseHeight = 100;
    const heightPerField = 80;
    const height = Math.max(250, baseHeight + fieldCount * heightPerField);

    heights.set(inst.id, height);
  });

  return heights;
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
