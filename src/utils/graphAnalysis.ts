import type { StructInstance, PointerConnection } from "../types";

/**
 * Circular pattern types detected in the graph
 */
export const CircularPattern = {
  SELF_LOOP: "SELF_LOOP", // A → A
  BIDIRECTIONAL: "BIDIRECTIONAL", // A ⇄ B
  CIRCULAR_LIST: "CIRCULAR_LIST", // A → B → C → A
  GENERAL_CYCLE: "GENERAL_CYCLE", // Complex cycle pattern
} as const;

export type CircularPattern =
  (typeof CircularPattern)[keyof typeof CircularPattern];

/**
 * A group of instances forming a strongly connected component
 */
export interface InstanceGroup {
  ids: Set<string>; // Instance IDs in this group
  pattern: CircularPattern; // Type of circular pattern
  isStronglyConnected: boolean;
}

/**
 * Complete graph analysis metrics
 */
export interface GraphMetrics {
  sccs: InstanceGroup[]; // All strongly connected components
  backEdges: PointerConnection[]; // Edges pointing backwards
  acyclicNodes: Set<string>; // Nodes not part of any cycle
  hasCycles: boolean; // Whether graph has any cycles
}

/**
 * Build adjacency list representation of the graph
 */
export function buildAdjacencyList(
  instances: StructInstance[],
  connections: PointerConnection[],
): Map<string, Set<string>> {
  const adjacencyList = new Map<string, Set<string>>();

  // Initialize all nodes
  instances.forEach((instance) => {
    adjacencyList.set(instance.id, new Set());
  });

  // Add edges
  connections.forEach((conn) => {
    const neighbors = adjacencyList.get(conn.sourceInstanceId);
    if (neighbors) {
      neighbors.add(conn.targetInstanceId);
    }
  });

  return adjacencyList;
}

/**
 * Tarjan's algorithm for finding strongly connected components
 * Complexity: O(V + E)
 */
export function findStronglyConnectedComponents(
  instances: StructInstance[],
  connections: PointerConnection[],
): InstanceGroup[] {
  const adjacencyList = buildAdjacencyList(instances, connections);
  const sccs: Set<string>[] = [];

  let index = 0;
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];

  function strongConnect(v: string) {
    indices.set(v, index);
    lowlinks.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    const neighbors = adjacencyList.get(v) || new Set();
    for (const w of neighbors) {
      if (!indices.has(w)) {
        // Successor w has not yet been visited; recurse on it
        strongConnect(w);
        lowlinks.set(v, Math.min(lowlinks.get(v)!, lowlinks.get(w)!));
      } else if (onStack.has(w)) {
        // Successor w is in stack and hence in the current SCC
        lowlinks.set(v, Math.min(lowlinks.get(v)!, indices.get(w)!));
      }
    }

    // If v is a root node, pop the stack and create an SCC
    if (lowlinks.get(v) === indices.get(v)) {
      const scc = new Set<string>();
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.add(w);
      } while (w !== v);

      // Only add SCCs with more than 1 node (actual cycles)
      // or single nodes with self-loops
      if (scc.size > 1 || hasSelfLoop(v, connections)) {
        sccs.push(scc);
      }
    }
  }

  // Run algorithm on all unvisited nodes
  instances.forEach((instance) => {
    if (!indices.has(instance.id)) {
      strongConnect(instance.id);
    }
  });

  // Convert to InstanceGroup with pattern classification
  return sccs.map((scc) => ({
    ids: scc,
    pattern: classifyCircularPattern(scc, connections),
    isStronglyConnected: true,
  }));
}

/**
 * Check if a node has a self-loop
 */
function hasSelfLoop(
  nodeId: string,
  connections: PointerConnection[],
): boolean {
  return connections.some(
    (conn) =>
      conn.sourceInstanceId === nodeId && conn.targetInstanceId === nodeId,
  );
}

/**
 * Classify the type of circular pattern in a strongly connected component
 */
export function classifyCircularPattern(
  sccIds: Set<string>,
  connections: PointerConnection[],
): CircularPattern {
  const nodeIds = Array.from(sccIds);

  // Self-loop: single node with edge to itself
  if (nodeIds.length === 1) {
    return CircularPattern.SELF_LOOP;
  }

  // Bidirectional: two nodes with edges in both directions
  if (nodeIds.length === 2) {
    const [a, b] = nodeIds;
    const hasAtoB = connections.some(
      (c) => c.sourceInstanceId === a && c.targetInstanceId === b,
    );
    const hasBtoA = connections.some(
      (c) => c.sourceInstanceId === b && c.targetInstanceId === a,
    );

    if (hasAtoB && hasBtoA) {
      return CircularPattern.BIDIRECTIONAL;
    }
  }

  // Check if it's a simple circular list (each node has exactly one outgoing edge in the cycle)
  const sccConnections = connections.filter(
    (c) => sccIds.has(c.sourceInstanceId) && sccIds.has(c.targetInstanceId),
  );

  // Count outgoing edges per node within the SCC
  const outgoingCount = new Map<string, number>();
  nodeIds.forEach((id) => outgoingCount.set(id, 0));

  sccConnections.forEach((conn) => {
    outgoingCount.set(
      conn.sourceInstanceId,
      (outgoingCount.get(conn.sourceInstanceId) || 0) + 1,
    );
  });

  // If each node has exactly 1 outgoing edge, it's a simple circular list
  const allHaveOneOutgoing = nodeIds.every((id) => outgoingCount.get(id) === 1);

  if (allHaveOneOutgoing && sccConnections.length === nodeIds.length) {
    return CircularPattern.CIRCULAR_LIST;
  }

  // Otherwise, it's a general cycle (complex pattern)
  return CircularPattern.GENERAL_CYCLE;
}

/**
 * Check if two nodes form a bidirectional pair (doubly-linked)
 */
export function isDoublyLinkedPair(
  node1: string,
  node2: string,
  connections: PointerConnection[],
): boolean {
  const hasForward = connections.some(
    (c) => c.sourceInstanceId === node1 && c.targetInstanceId === node2,
  );
  const hasBackward = connections.some(
    (c) => c.sourceInstanceId === node2 && c.targetInstanceId === node1,
  );

  return hasForward && hasBackward;
}

/**
 * Find all back-edges in the graph (edges that create cycles)
 * Uses DFS to find edges that point to ancestors
 */
export function findBackEdges(
  instances: StructInstance[],
  connections: PointerConnection[],
): PointerConnection[] {
  const adjacencyList = buildAdjacencyList(instances, connections);
  const backEdges: PointerConnection[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(nodeId: string) {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adjacencyList.get(nodeId) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recursionStack.has(neighbor)) {
        // Found a back edge
        const backEdge = connections.find(
          (c) =>
            c.sourceInstanceId === nodeId && c.targetInstanceId === neighbor,
        );
        if (backEdge) {
          backEdges.push(backEdge);
        }
      }
    }

    recursionStack.delete(nodeId);
  }

  instances.forEach((instance) => {
    if (!visited.has(instance.id)) {
      dfs(instance.id);
    }
  });

  return backEdges;
}

/**
 * Perform topological sort with cycle detection
 * Returns sorted nodes and whether a cycle exists
 */
export function topologicalSort(
  instances: StructInstance[],
  connections: PointerConnection[],
): { sorted: string[]; hasCycle: boolean } {
  const adjacencyList = buildAdjacencyList(instances, connections);
  const inDegree = new Map<string, number>();
  const sorted: string[] = [];
  const queue: string[] = [];

  // Initialize in-degrees
  instances.forEach((instance) => {
    inDegree.set(instance.id, 0);
  });

  connections.forEach((conn) => {
    inDegree.set(
      conn.targetInstanceId,
      (inDegree.get(conn.targetInstanceId) || 0) + 1,
    );
  });

  // Add nodes with in-degree 0 to queue
  instances.forEach((instance) => {
    if (inDegree.get(instance.id) === 0) {
      queue.push(instance.id);
    }
  });

  // Process queue
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    const neighbors = adjacencyList.get(current) || new Set();
    for (const neighbor of neighbors) {
      const newInDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newInDegree);

      if (newInDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // If sorted doesn't contain all nodes, there's a cycle
  const hasCycle = sorted.length !== instances.length;

  return { sorted, hasCycle };
}

/**
 * Analyze the complete graph and return comprehensive metrics
 */
export function analyzeGraph(
  instances: StructInstance[],
  connections: PointerConnection[],
): GraphMetrics {
  // Find all strongly connected components
  const sccs = findStronglyConnectedComponents(instances, connections);

  // Find back edges
  const backEdges = findBackEdges(instances, connections);

  // Determine which nodes are acyclic (not part of any SCC)
  const sccNodeIds = new Set<string>();
  sccs.forEach((scc) => {
    scc.ids.forEach((id) => sccNodeIds.add(id));
  });

  const acyclicNodes = new Set<string>();
  instances.forEach((instance) => {
    if (!sccNodeIds.has(instance.id)) {
      acyclicNodes.add(instance.id);
    }
  });

  return {
    sccs,
    backEdges,
    acyclicNodes,
    hasCycles: sccs.length > 0,
  };
}

/**
 * Get a human-readable name for a circular pattern
 */
export function getPatternName(pattern: CircularPattern): string {
  switch (pattern) {
    case CircularPattern.SELF_LOOP:
      return "Self-Loop";
    case CircularPattern.BIDIRECTIONAL:
      return "Doubly-Linked";
    case CircularPattern.CIRCULAR_LIST:
      return "Circular List";
    case CircularPattern.GENERAL_CYCLE:
      return "Complex Cycle";
  }
}

/**
 * Check if an edge is a back-edge
 */
export function isBackEdge(
  edge: PointerConnection,
  backEdges: PointerConnection[],
): boolean {
  return backEdges.some((be) => be.id === edge.id);
}

/**
 * Get all edges within a strongly connected component
 */
export function getSCCEdges(
  scc: InstanceGroup,
  connections: PointerConnection[],
): PointerConnection[] {
  return connections.filter(
    (conn) =>
      scc.ids.has(conn.sourceInstanceId) && scc.ids.has(conn.targetInstanceId),
  );
}
