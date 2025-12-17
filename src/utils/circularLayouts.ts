import type { StructInstance, PointerConnection } from "../types";
import type { InstanceGroup } from "./graphAnalysis";

/**
 * Edge layout configuration for special rendering
 */
export interface EdgeLayout {
  connectionId: string;
  edgeType?: "bezier" | "smoothstep" | "straight";
  controlPoints?: Array<{ x: number; y: number }>;
  style?: {
    stroke?: string;
    strokeWidth?: number;
    strokeDasharray?: string;
    opacity?: number;
  };
  pathOptions?: {
    offset?: number;
    curvature?: number;
    borderRadius?: number;
  };
  animated?: boolean;
  markerEnd?: {
    type: string;
    color: string;
  };
}

/**
 * Layout result containing positions and edge configurations
 */
export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
  edgeLayouts: EdgeLayout[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
}

/**
 * Layout a self-loop pattern (A → A)
 * Creates a curved bezier edge that loops out and back to the same node
 */
export function layoutSelfLoop(
  scc: InstanceGroup,
  instances: StructInstance[],
  connections: PointerConnection[],
  centerX: number = 0,
  centerY: number = 0,
): LayoutResult {
  const nodeId = Array.from(scc.ids)[0];
  const instance = instances.find((i) => i.id === nodeId);

  if (!instance) {
    return createEmptyLayout();
  }

  // Always use calculated center position for consistent layout
  const position = { x: centerX, y: centerY };

  // Find the self-loop connection
  const selfLoopConnection = connections.find(
    (conn) =>
      conn.sourceInstanceId === nodeId && conn.targetInstanceId === nodeId,
  );

  const edgeLayouts: EdgeLayout[] = [];

  if (selfLoopConnection) {
    // Create a curved loop above and to the right of the node
    edgeLayouts.push({
      connectionId: selfLoopConnection.id,
      edgeType: "bezier",
      style: {
        stroke: "#FF6B6B", // Distinctive red color for self-loops
        strokeWidth: 3,
        strokeDasharray: "5,5", // Dashed line
      },
      pathOptions: {
        offset: 80, // Large offset to create visible loop
        curvature: 0.8,
      },
      animated: true,
      markerEnd: {
        type: "arrowclosed",
        color: "#FF6B6B",
      },
    });
  }

  const positions = new Map([[nodeId, position]]);

  return {
    positions,
    edgeLayouts,
    bounds: calculateBounds(positions),
  };
}

/**
 * Layout a bidirectional (doubly-linked) pattern (A ⇄ B)
 * Positions nodes vertically (one above the other) to prevent edge overlap
 * This ensures forward and backward edges flow cleanly without crossing nodes
 */
export function layoutDoublyLinked(
  scc: InstanceGroup,
  instances: StructInstance[],
  connections: PointerConnection[],
  centerX: number = 0,
  centerY: number = 0,
): LayoutResult {
  const nodeIds = Array.from(scc.ids);
  if (nodeIds.length !== 2) {
    return createEmptyLayout();
  }

  const [id1, id2] = nodeIds;
  const instance1 = instances.find((i) => i.id === id1);
  const instance2 = instances.find((i) => i.id === id2);

  if (!instance1 || !instance2) {
    return createEmptyLayout();
  }

  // Position nodes VERTICALLY (stacked) to prevent bidirectional edges from overlapping
  // This ensures forward edge goes right->down->left, backward goes left->up->right
  const verticalSpacing = 350; // Generous vertical spacing
  const pos1 = {
    x: centerX,
    y: centerY - verticalSpacing / 2, // Top node
  };
  const pos2 = {
    x: centerX,
    y: centerY + verticalSpacing / 2, // Bottom node
  };

  // Find forward and backward connections
  const forwardConn = connections.find(
    (c) => c.sourceInstanceId === id1 && c.targetInstanceId === id2,
  );
  const backwardConn = connections.find(
    (c) => c.sourceInstanceId === id2 && c.targetInstanceId === id1,
  );

  const edgeLayouts: EdgeLayout[] = [];

  // Style for doubly-linked edges
  const doubleLinkedStyle = {
    stroke: "#4ECDC4", // Cyan/turquoise for doubly-linked
    strokeWidth: 3,
  };

  if (forwardConn) {
    edgeLayouts.push({
      connectionId: forwardConn.id,
      edgeType: "smoothstep",
      style: doubleLinkedStyle,
      pathOptions: {
        offset: 40, // Offset to the right for forward edge
        curvature: 0.3,
        borderRadius: 20,
      },
      markerEnd: {
        type: "arrowclosed",
        color: "#4ECDC4",
      },
    });
  }

  if (backwardConn) {
    edgeLayouts.push({
      connectionId: backwardConn.id,
      edgeType: "smoothstep",
      style: doubleLinkedStyle,
      pathOptions: {
        offset: -40, // Offset to the left for backward edge
        curvature: 0.3,
        borderRadius: 20,
      },
      markerEnd: {
        type: "arrowclosed",
        color: "#4ECDC4",
      },
    });
  }

  const positions = new Map([
    [id1, pos1],
    [id2, pos2],
  ]);

  return {
    positions,
    edgeLayouts,
    bounds: calculateBounds(positions),
  };
}

/**
 * Layout a circular list pattern (A → B → C → A)
 * Arranges nodes in a circle with MUCH larger radius to prevent edge-node overlap
 * Nodes positioned to ensure edges flow around the perimeter, not through the center
 */
export function layoutCircularList(
  scc: InstanceGroup,
  _instances: StructInstance[],
  connections: PointerConnection[],
  centerX: number = 0,
  centerY: number = 0,
): LayoutResult {
  const nodeIds = Array.from(scc.ids);
  const nodeCount = nodeIds.length;

  if (nodeCount === 0) {
    return createEmptyLayout();
  }

  // SIGNIFICANTLY increased radius to prevent edges from crossing through nodes
  // Formula: more nodes need exponentially more space
  // Minimum 450px radius ensures edges go around, not through
  const baseRadius = 450;
  const radiusPerNode = 150; // Generous spacing per node
  const radius = Math.max(baseRadius, nodeCount * radiusPerNode);

  const angleStep = (2 * Math.PI) / nodeCount;
  const positions = new Map<string, { x: number; y: number }>();

  // Arrange nodes in a circle starting from top (for better visual symmetry)
  // Starting from -PI/2 (top) and going clockwise
  nodeIds.forEach((id, index) => {
    // Start from top (-PI/2) and go clockwise for clean flow
    const angle = -Math.PI / 2 + index * angleStep;
    positions.set(id, {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    });
  });

  // Find all connections within the SCC
  const sccConnections = connections.filter(
    (c) => scc.ids.has(c.sourceInstanceId) && scc.ids.has(c.targetInstanceId),
  );

  const edgeLayouts: EdgeLayout[] = sccConnections.map((conn) => ({
    connectionId: conn.id,
    edgeType: "smoothstep",
    style: {
      stroke: "#FF6B6B", // Red for circular edges
      strokeWidth: 3,
    },
    pathOptions: {
      borderRadius: 30, // Larger radius for smoother curves that avoid center
    },
    animated: true,
    markerEnd: {
      type: "arrowclosed",
      color: "#FF6B6B",
    },
  }));

  return {
    positions,
    edgeLayouts,
    bounds: calculateBounds(positions),
  };
}

/**
 * Layout a general cycle pattern (complex cycles)
 * Uses LARGE radial layout to ensure edges route around perimeter, not through center
 */
export function layoutGeneralCycle(
  scc: InstanceGroup,
  _instances: StructInstance[],
  connections: PointerConnection[],
  centerX: number = 0,
  centerY: number = 0,
): LayoutResult {
  const nodeIds = Array.from(scc.ids);
  const nodeCount = nodeIds.length;

  if (nodeCount === 0) {
    return createEmptyLayout();
  }

  // MUCH larger radius for complex cycles to prevent edge-node overlap
  // Complex cycles need even more space than simple circular lists
  const baseRadius = 500;
  const radiusPerNode = 180; // Extra generous for complex patterns
  const radius = Math.max(baseRadius, nodeCount * radiusPerNode);

  const angleStep = (2 * Math.PI) / nodeCount;
  const positions = new Map<string, { x: number; y: number }>();

  // Arrange nodes starting from top for visual clarity
  nodeIds.forEach((id, index) => {
    // Start from top (-PI/2) for better symmetry
    const angle = -Math.PI / 2 + index * angleStep;
    positions.set(id, {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    });
  });

  // Mark all edges in general cycle with orange color
  const sccConnections = connections.filter(
    (c) => scc.ids.has(c.sourceInstanceId) && scc.ids.has(c.targetInstanceId),
  );

  const edgeLayouts: EdgeLayout[] = sccConnections.map((conn) => ({
    connectionId: conn.id,
    edgeType: "smoothstep",
    style: {
      stroke: "#FFA500", // Orange for general cycles
      strokeWidth: 3,
      strokeDasharray: "8,4", // Dashed for complexity
    },
    pathOptions: {
      borderRadius: 40, // Large border radius for sweeping curves around perimeter
    },
    animated: true,
    markerEnd: {
      type: "arrowclosed",
      color: "#FFA500",
    },
  }));

  return {
    positions,
    edgeLayouts,
    bounds: calculateBounds(positions),
  };
}

/**
 * Calculate bounding box for a set of positions
 */
function calculateBounds(positions: Map<string, { x: number; y: number }>): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (positions.size === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  positions.forEach((pos) => {
    minX = Math.min(minX, pos.x);
    maxX = Math.max(maxX, pos.x);
    minY = Math.min(minY, pos.y);
    maxY = Math.max(maxY, pos.y);
  });

  // Add padding for node size (approximate 300px width, 250px height)
  const nodePadding = 350;
  minX -= nodePadding / 2;
  maxX += nodePadding / 2;
  minY -= 250 / 2;
  maxY += 250 / 2;

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Create an empty layout result
 */
function createEmptyLayout(): LayoutResult {
  return {
    positions: new Map(),
    edgeLayouts: [],
    bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 },
  };
}

/**
 * Combine multiple layout results with proper spacing
 */
export function combineLayouts(
  layouts: LayoutResult[],
  spacing: { horizontalGap: number; verticalGap: number } = {
    horizontalGap: 400,
    verticalGap: 300,
  },
): LayoutResult {
  if (layouts.length === 0) {
    return createEmptyLayout();
  }

  if (layouts.length === 1) {
    return layouts[0];
  }

  const combinedPositions = new Map<string, { x: number; y: number }>();
  const combinedEdgeLayouts: EdgeLayout[] = [];

  let currentX = 0;
  let maxY = 0;

  layouts.forEach((layout) => {
    // Offset all positions in this layout
    layout.positions.forEach((pos, id) => {
      combinedPositions.set(id, {
        x: pos.x + currentX - layout.bounds.minX,
        y: pos.y - layout.bounds.minY,
      });
    });

    // Add edge layouts
    combinedEdgeLayouts.push(...layout.edgeLayouts);

    // Track max Y for vertical arrangement if needed
    maxY = Math.max(maxY, layout.bounds.height);

    // Move X position for next layout
    currentX += layout.bounds.width + spacing.horizontalGap;
  });

  return {
    positions: combinedPositions,
    edgeLayouts: combinedEdgeLayouts,
    bounds: calculateBounds(combinedPositions),
  };
}
