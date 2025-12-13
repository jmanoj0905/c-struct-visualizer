import { describe, it, expect } from "vitest";
import {
  layoutSelfLoop,
  layoutDoublyLinked,
  layoutCircularList,
  layoutGeneralCycle,
  combineLayouts,
} from "./circularLayouts";
import { CircularPattern } from "./graphAnalysis";
import type { StructInstance, PointerConnection } from "../types";
import type { InstanceGroup } from "./graphAnalysis";

// Helper to create test instances
function createInstance(
  id: string,
  x: number = 0,
  y: number = 0,
): StructInstance {
  return {
    id,
    structName: "Node",
    instanceName: id,
    position: { x, y },
    fieldValues: {},
  };
}

// Helper to create test connection
function createConnection(
  id: string,
  source: string,
  target: string,
): PointerConnection {
  return {
    id,
    sourceInstanceId: source,
    targetInstanceId: target,
    sourceFieldName: "next",
  };
}

describe("layoutSelfLoop", () => {
  it("should layout a self-loop with correct styling", () => {
    const instances = [createInstance("A", 100, 200)];
    const connections = [createConnection("1", "A", "A")];
    const scc: InstanceGroup = {
      ids: new Set(["A"]),
      pattern: CircularPattern.SELF_LOOP,
      isStronglyConnected: true,
    };

    const result = layoutSelfLoop(scc, instances, connections);

    expect(result.positions.size).toBe(1);
    expect(result.positions.get("A")).toEqual({ x: 100, y: 200 });
    expect(result.edgeLayouts).toHaveLength(1);
    expect(result.edgeLayouts[0].style?.stroke).toBe("#FF6B6B");
    expect(result.edgeLayouts[0].style?.strokeDasharray).toBe("5,5");
    expect(result.edgeLayouts[0].animated).toBe(true);
  });

  it("should use center position if instance has no position", () => {
    const instances = [
      {
        id: "A",
        structName: "Node",
        instanceName: "A",
        position: undefined as any,
        fieldValues: {},
      },
    ];
    const connections = [createConnection("1", "A", "A")];
    const scc: InstanceGroup = {
      ids: new Set(["A"]),
      pattern: CircularPattern.SELF_LOOP,
      isStronglyConnected: true,
    };

    const result = layoutSelfLoop(scc, instances, connections, 300, 400);

    expect(result.positions.get("A")).toEqual({ x: 300, y: 400 });
  });

  it("should handle missing instance gracefully", () => {
    const instances: StructInstance[] = [];
    const connections: PointerConnection[] = [];
    const scc: InstanceGroup = {
      ids: new Set(["A"]),
      pattern: CircularPattern.SELF_LOOP,
      isStronglyConnected: true,
    };

    const result = layoutSelfLoop(scc, instances, connections);

    expect(result.positions.size).toBe(0);
    expect(result.edgeLayouts).toHaveLength(0);
  });
});

describe("layoutDoublyLinked", () => {
  it("should layout doubly-linked nodes with offset edges", () => {
    const instances = [
      createInstance("A", 100, 200),
      createInstance("B", 500, 200),
    ];
    const connections = [
      createConnection("1", "A", "B"),
      createConnection("2", "B", "A"),
    ];
    const scc: InstanceGroup = {
      ids: new Set(["A", "B"]),
      pattern: CircularPattern.BIDIRECTIONAL,
      isStronglyConnected: true,
    };

    const result = layoutDoublyLinked(scc, instances, connections);

    expect(result.positions.size).toBe(2);
    expect(result.positions.get("A")).toEqual({ x: 100, y: 200 });
    expect(result.positions.get("B")).toEqual({ x: 500, y: 200 });
    expect(result.edgeLayouts).toHaveLength(2);

    // Check styling
    result.edgeLayouts.forEach((edge) => {
      expect(edge.style?.stroke).toBe("#4ECDC4");
      expect(edge.pathOptions?.curvature).toBe(0.25);
      expect(edge.edgeType).toBe("smoothstep");
    });

    // Check offsets are opposite
    const offsets = result.edgeLayouts.map((e) => e.pathOptions?.offset);
    expect(offsets).toContain(20);
    expect(offsets).toContain(-20);
  });

  it("should use center positions for new layout", () => {
    const instances = [
      {
        id: "A",
        structName: "Node",
        instanceName: "A",
        position: undefined as any,
        fieldValues: {},
      },
      {
        id: "B",
        structName: "Node",
        instanceName: "B",
        position: undefined as any,
        fieldValues: {},
      },
    ];
    const connections = [
      createConnection("1", "A", "B"),
      createConnection("2", "B", "A"),
    ];
    const scc: InstanceGroup = {
      ids: new Set(["A", "B"]),
      pattern: CircularPattern.BIDIRECTIONAL,
      isStronglyConnected: true,
    };

    const result = layoutDoublyLinked(scc, instances, connections, 400, 300);

    // With horizontalSpacing = 500, centerX = 400
    // pos1.x = 400 - 500/2 = 150
    // pos2.x = 400 + 500/2 = 650
    expect(result.positions.get("A")).toEqual({ x: 150, y: 300 });
    expect(result.positions.get("B")).toEqual({ x: 650, y: 300 });
  });

  it("should handle single direction connection", () => {
    const instances = [createInstance("A"), createInstance("B")];
    const connections = [createConnection("1", "A", "B")]; // Only one direction
    const scc: InstanceGroup = {
      ids: new Set(["A", "B"]),
      pattern: CircularPattern.BIDIRECTIONAL,
      isStronglyConnected: true,
    };

    const result = layoutDoublyLinked(scc, instances, connections);

    expect(result.edgeLayouts).toHaveLength(1);
  });
});

describe("layoutCircularList", () => {
  it("should arrange nodes in a circle", () => {
    const instances = [
      createInstance("A"),
      createInstance("B"),
      createInstance("C"),
    ];
    const connections = [
      createConnection("1", "A", "B"),
      createConnection("2", "B", "C"),
      createConnection("3", "C", "A"),
    ];
    const scc: InstanceGroup = {
      ids: new Set(["A", "B", "C"]),
      pattern: CircularPattern.CIRCULAR_LIST,
      isStronglyConnected: true,
    };

    const result = layoutCircularList(scc, instances, connections, 0, 0);

    expect(result.positions.size).toBe(3);

    // Check all nodes have positions
    expect(result.positions.has("A")).toBe(true);
    expect(result.positions.has("B")).toBe(true);
    expect(result.positions.has("C")).toBe(true);

    // Verify positions are on a circle (roughly)
    const posA = result.positions.get("A")!;
    const posB = result.positions.get("B")!;
    const posC = result.positions.get("C")!;

    const distA = Math.sqrt(posA.x ** 2 + posA.y ** 2);
    const distB = Math.sqrt(posB.x ** 2 + posB.y ** 2);
    const distC = Math.sqrt(posC.x ** 2 + posC.y ** 2);

    // All should be roughly same distance from center
    expect(Math.abs(distA - distB)).toBeLessThan(1);
    expect(Math.abs(distB - distC)).toBeLessThan(1);

    // Check edge styling
    expect(result.edgeLayouts).toHaveLength(3);
    result.edgeLayouts.forEach((edge) => {
      expect(edge.style?.stroke).toBe("#FF6B6B");
      expect(edge.animated).toBe(true);
    });
  });

  it("should scale radius with node count", () => {
    const instances = Array.from({ length: 10 }, (_, i) =>
      createInstance(`node${i}`),
    );
    const scc: InstanceGroup = {
      ids: new Set(instances.map((i) => i.id)),
      pattern: CircularPattern.CIRCULAR_LIST,
      isStronglyConnected: true,
    };

    const result = layoutCircularList(scc, instances, [], 0, 0);

    // With 10 nodes, radius should be max(300, 10 * 120) = 1200
    const firstPos = result.positions.get("node0")!;
    const radius = Math.sqrt(firstPos.x ** 2 + firstPos.y ** 2);
    expect(radius).toBeCloseTo(1200, 0);
  });

  it("should start from right side of circle", () => {
    const instances = [createInstance("A")];
    const scc: InstanceGroup = {
      ids: new Set(["A"]),
      pattern: CircularPattern.CIRCULAR_LIST,
      isStronglyConnected: true,
    };

    const result = layoutCircularList(scc, instances, [], 0, 0);

    const pos = result.positions.get("A")!;
    // First node should be at right side (x positive, y near 0)
    expect(pos.x).toBeGreaterThan(0);
    expect(pos.y).toBeCloseTo(0, 0);
  });
});

describe("layoutGeneralCycle", () => {
  it("should layout complex cycle with radial arrangement", () => {
    const instances = [
      createInstance("A"),
      createInstance("B"),
      createInstance("C"),
    ];
    const connections = [
      createConnection("1", "A", "B"),
      createConnection("2", "B", "C"),
      createConnection("3", "C", "A"),
      createConnection("4", "A", "C"), // Extra edge
    ];
    const scc: InstanceGroup = {
      ids: new Set(["A", "B", "C"]),
      pattern: CircularPattern.GENERAL_CYCLE,
      isStronglyConnected: true,
    };

    const result = layoutGeneralCycle(scc, instances, connections);

    expect(result.positions.size).toBe(3);
    expect(result.edgeLayouts).toHaveLength(4);

    // Check styling for general cycle
    result.edgeLayouts.forEach((edge) => {
      expect(edge.style?.stroke).toBe("#FFA500");
      expect(edge.style?.strokeDasharray).toBe("8,4");
      expect(edge.animated).toBe(true);
    });
  });

  it("should use larger radius for complex cycles", () => {
    const instances = Array.from({ length: 5 }, (_, i) =>
      createInstance(`node${i}`),
    );
    const scc: InstanceGroup = {
      ids: new Set(instances.map((i) => i.id)),
      pattern: CircularPattern.GENERAL_CYCLE,
      isStronglyConnected: true,
    };

    const result = layoutGeneralCycle(scc, instances, [], 0, 0);

    // With 5 nodes, radius should be max(400, 5 * 150) = 750
    const firstPos = result.positions.get("node0")!;
    const radius = Math.sqrt(firstPos.x ** 2 + firstPos.y ** 2);
    expect(radius).toBeCloseTo(750, 0);
  });
});

describe("combineLayouts", () => {
  it("should combine multiple layouts horizontally", () => {
    const layout1 = layoutCircularList(
      {
        ids: new Set(["A", "B"]),
        pattern: CircularPattern.CIRCULAR_LIST,
        isStronglyConnected: true,
      },
      [createInstance("A"), createInstance("B")],
      [],
      0,
      0,
    );

    const layout2 = layoutCircularList(
      {
        ids: new Set(["C", "D"]),
        pattern: CircularPattern.CIRCULAR_LIST,
        isStronglyConnected: true,
      },
      [createInstance("C"), createInstance("D")],
      [],
      0,
      0,
    );

    const combined = combineLayouts([layout1, layout2], {
      horizontalGap: 500,
      verticalGap: 300,
    });

    expect(combined.positions.size).toBe(4);
    expect(combined.positions.has("A")).toBe(true);
    expect(combined.positions.has("B")).toBe(true);
    expect(combined.positions.has("C")).toBe(true);
    expect(combined.positions.has("D")).toBe(true);

    // Second layout should be offset horizontally
    const posA = combined.positions.get("A")!;
    const posC = combined.positions.get("C")!;
    expect(posC.x).toBeGreaterThan(posA.x);
  });

  it("should preserve edge layouts from all inputs", () => {
    const layout1 = layoutSelfLoop(
      {
        ids: new Set(["A"]),
        pattern: CircularPattern.SELF_LOOP,
        isStronglyConnected: true,
      },
      [createInstance("A")],
      [createConnection("1", "A", "A")],
    );

    const layout2 = layoutSelfLoop(
      {
        ids: new Set(["B"]),
        pattern: CircularPattern.SELF_LOOP,
        isStronglyConnected: true,
      },
      [createInstance("B")],
      [createConnection("2", "B", "B")],
    );

    const combined = combineLayouts([layout1, layout2]);

    expect(combined.edgeLayouts).toHaveLength(2);
    expect(combined.edgeLayouts[0].connectionId).toBe("1");
    expect(combined.edgeLayouts[1].connectionId).toBe("2");
  });

  it("should return empty layout for empty input", () => {
    const result = combineLayouts([]);

    expect(result.positions.size).toBe(0);
    expect(result.edgeLayouts).toHaveLength(0);
    expect(result.bounds.width).toBe(0);
  });

  it("should return single layout unchanged", () => {
    const layout = layoutCircularList(
      {
        ids: new Set(["A", "B", "C"]),
        pattern: CircularPattern.CIRCULAR_LIST,
        isStronglyConnected: true,
      },
      [createInstance("A"), createInstance("B"), createInstance("C")],
      [],
    );

    const combined = combineLayouts([layout]);

    expect(combined).toEqual(layout);
  });

  it("should calculate correct bounds", () => {
    const layout1 = layoutCircularList(
      {
        ids: new Set(["A"]),
        pattern: CircularPattern.CIRCULAR_LIST,
        isStronglyConnected: true,
      },
      [createInstance("A")],
      [],
      0,
      0,
    );

    const combined = combineLayouts([layout1]);

    expect(combined.bounds.width).toBeGreaterThan(0);
    expect(combined.bounds.height).toBeGreaterThan(0);
    expect(combined.bounds.maxX).toBeGreaterThan(combined.bounds.minX);
    expect(combined.bounds.maxY).toBeGreaterThan(combined.bounds.minY);
  });
});
