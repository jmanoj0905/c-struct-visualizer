import { describe, it, expect } from "vitest";
import {
  findStronglyConnectedComponents,
  classifyCircularPattern,
  isDoublyLinkedPair,
  findBackEdges,
  topologicalSort,
  analyzeGraph,
  CircularPattern,
  buildAdjacencyList,
  getPatternName,
} from "./graphAnalysis";
import type { StructInstance, PointerConnection } from "../types";

// Helper function to create test instances
function createInstance(id: string, structName: string = "Node"): StructInstance {
  return {
    id,
    structName,
    instanceName: id,
    position: { x: 0, y: 0 },
    fieldValues: {},
  };
}

// Helper function to create test connection
function createConnection(
  id: string,
  source: string,
  target: string,
  fieldName: string = "next",
): PointerConnection {
  return {
    id,
    sourceInstanceId: source,
    targetInstanceId: target,
    sourceFieldName: fieldName,
  };
}

describe("buildAdjacencyList", () => {
  it("should build correct adjacency list for simple graph", () => {
    const instances = [createInstance("A"), createInstance("B"), createInstance("C")];
    const connections = [
      createConnection("1", "A", "B"),
      createConnection("2", "B", "C"),
    ];

    const adjList = buildAdjacencyList(instances, connections);

    expect(adjList.get("A")).toEqual(new Set(["B"]));
    expect(adjList.get("B")).toEqual(new Set(["C"]));
    expect(adjList.get("C")).toEqual(new Set([]));
  });

  it("should handle self-loops", () => {
    const instances = [createInstance("A")];
    const connections = [createConnection("1", "A", "A")];

    const adjList = buildAdjacencyList(instances, connections);

    expect(adjList.get("A")).toEqual(new Set(["A"]));
  });
});

describe("findStronglyConnectedComponents", () => {
  it("should detect self-loop", () => {
    const instances = [createInstance("A")];
    const connections = [createConnection("1", "A", "A")];

    const sccs = findStronglyConnectedComponents(instances, connections);

    expect(sccs).toHaveLength(1);
    expect(sccs[0].ids).toEqual(new Set(["A"]));
    expect(sccs[0].pattern).toBe(CircularPattern.SELF_LOOP);
  });

  it("should detect bidirectional link (A ⇄ B)", () => {
    const instances = [createInstance("A"), createInstance("B")];
    const connections = [
      createConnection("1", "A", "B"),
      createConnection("2", "B", "A"),
    ];

    const sccs = findStronglyConnectedComponents(instances, connections);

    expect(sccs).toHaveLength(1);
    expect(sccs[0].ids).toEqual(new Set(["A", "B"]));
    expect(sccs[0].pattern).toBe(CircularPattern.BIDIRECTIONAL);
  });

  it("should detect circular list (A → B → C → A)", () => {
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

    const sccs = findStronglyConnectedComponents(instances, connections);

    expect(sccs).toHaveLength(1);
    expect(sccs[0].ids).toEqual(new Set(["A", "B", "C"]));
    expect(sccs[0].pattern).toBe(CircularPattern.CIRCULAR_LIST);
  });

  it("should detect no SCCs in acyclic graph", () => {
    const instances = [
      createInstance("A"),
      createInstance("B"),
      createInstance("C"),
    ];
    const connections = [
      createConnection("1", "A", "B"),
      createConnection("2", "B", "C"),
    ];

    const sccs = findStronglyConnectedComponents(instances, connections);

    expect(sccs).toHaveLength(0);
  });

  it("should detect multiple SCCs", () => {
    const instances = [
      createInstance("A"),
      createInstance("B"),
      createInstance("C"),
      createInstance("D"),
    ];
    const connections = [
      createConnection("1", "A", "B"),
      createConnection("2", "B", "A"), // SCC 1: A ⇄ B
      createConnection("3", "C", "D"),
      createConnection("4", "D", "C"), // SCC 2: C ⇄ D
    ];

    const sccs = findStronglyConnectedComponents(instances, connections);

    expect(sccs).toHaveLength(2);
  });

  it("should handle complex cycle pattern", () => {
    const instances = [
      createInstance("A"),
      createInstance("B"),
      createInstance("C"),
    ];
    const connections = [
      createConnection("1", "A", "B"),
      createConnection("2", "B", "C"),
      createConnection("3", "C", "A"),
      createConnection("4", "A", "C"), // Extra edge making it complex
    ];

    const sccs = findStronglyConnectedComponents(instances, connections);

    expect(sccs).toHaveLength(1);
    expect(sccs[0].pattern).toBe(CircularPattern.GENERAL_CYCLE);
  });
});

describe("classifyCircularPattern", () => {
  it("should classify self-loop", () => {
    const scc = new Set(["A"]);
    const connections = [createConnection("1", "A", "A")];

    const pattern = classifyCircularPattern(scc, connections);

    expect(pattern).toBe(CircularPattern.SELF_LOOP);
  });

  it("should classify bidirectional", () => {
    const scc = new Set(["A", "B"]);
    const connections = [
      createConnection("1", "A", "B"),
      createConnection("2", "B", "A"),
    ];

    const pattern = classifyCircularPattern(scc, connections);

    expect(pattern).toBe(CircularPattern.BIDIRECTIONAL);
  });

  it("should classify circular list", () => {
    const scc = new Set(["A", "B", "C"]);
    const connections = [
      createConnection("1", "A", "B"),
      createConnection("2", "B", "C"),
      createConnection("3", "C", "A"),
    ];

    const pattern = classifyCircularPattern(scc, connections);

    expect(pattern).toBe(CircularPattern.CIRCULAR_LIST);
  });

  it("should classify general cycle", () => {
    const scc = new Set(["A", "B", "C"]);
    const connections = [
      createConnection("1", "A", "B"),
      createConnection("2", "B", "C"),
      createConnection("3", "C", "A"),
      createConnection("4", "A", "C"),
      createConnection("5", "B", "A"),
    ];

    const pattern = classifyCircularPattern(scc, connections);

    expect(pattern).toBe(CircularPattern.GENERAL_CYCLE);
  });
});

describe("isDoublyLinkedPair", () => {
  it("should detect doubly-linked pair", () => {
    const connections = [
      createConnection("1", "A", "B"),
      createConnection("2", "B", "A"),
    ];

    expect(isDoublyLinkedPair("A", "B", connections)).toBe(true);
  });

  it("should return false for single direction", () => {
    const connections = [createConnection("1", "A", "B")];

    expect(isDoublyLinkedPair("A", "B", connections)).toBe(false);
  });

  it("should return false for no connection", () => {
    const connections: PointerConnection[] = [];

    expect(isDoublyLinkedPair("A", "B", connections)).toBe(false);
  });
});

describe("findBackEdges", () => {
  it("should find back edge in simple cycle", () => {
    const instances = [
      createInstance("A"),
      createInstance("B"),
      createInstance("C"),
    ];
    const connections = [
      createConnection("1", "A", "B"),
      createConnection("2", "B", "C"),
      createConnection("3", "C", "A"), // Back edge
    ];

    const backEdges = findBackEdges(instances, connections);

    expect(backEdges).toHaveLength(1);
    expect(backEdges[0].id).toBe("3");
  });

  it("should find no back edges in acyclic graph", () => {
    const instances = [
      createInstance("A"),
      createInstance("B"),
      createInstance("C"),
    ];
    const connections = [
      createConnection("1", "A", "B"),
      createConnection("2", "B", "C"),
    ];

    const backEdges = findBackEdges(instances, connections);

    expect(backEdges).toHaveLength(0);
  });

  it("should find self-loop as back edge", () => {
    const instances = [createInstance("A")];
    const connections = [createConnection("1", "A", "A")];

    const backEdges = findBackEdges(instances, connections);

    expect(backEdges).toHaveLength(1);
  });
});

describe("topologicalSort", () => {
  it("should sort acyclic graph correctly", () => {
    const instances = [
      createInstance("A"),
      createInstance("B"),
      createInstance("C"),
    ];
    const connections = [
      createConnection("1", "A", "B"),
      createConnection("2", "B", "C"),
    ];

    const { sorted, hasCycle } = topologicalSort(instances, connections);

    expect(hasCycle).toBe(false);
    expect(sorted).toHaveLength(3);
    expect(sorted.indexOf("A")).toBeLessThan(sorted.indexOf("B"));
    expect(sorted.indexOf("B")).toBeLessThan(sorted.indexOf("C"));
  });

  it("should detect cycle in graph", () => {
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

    const { sorted, hasCycle } = topologicalSort(instances, connections);

    expect(hasCycle).toBe(true);
    expect(sorted.length).toBeLessThan(instances.length);
  });
});

describe("analyzeGraph", () => {
  it("should provide complete analysis for mixed graph", () => {
    const instances = [
      createInstance("A"),
      createInstance("B"),
      createInstance("C"),
      createInstance("D"),
    ];
    const connections = [
      createConnection("1", "A", "B"),
      createConnection("2", "B", "C"),
      createConnection("3", "C", "B"), // Cycle: B ⇄ C
      createConnection("4", "A", "D"), // D is acyclic
    ];

    const metrics = analyzeGraph(instances, connections);

    expect(metrics.hasCycles).toBe(true);
    expect(metrics.sccs).toHaveLength(1);
    expect(metrics.sccs[0].ids).toEqual(new Set(["B", "C"]));
    expect(metrics.acyclicNodes).toContain("A");
    expect(metrics.acyclicNodes).toContain("D");
    expect(metrics.backEdges.length).toBeGreaterThan(0);
  });

  it("should handle fully acyclic graph", () => {
    const instances = [
      createInstance("A"),
      createInstance("B"),
      createInstance("C"),
    ];
    const connections = [
      createConnection("1", "A", "B"),
      createConnection("2", "B", "C"),
    ];

    const metrics = analyzeGraph(instances, connections);

    expect(metrics.hasCycles).toBe(false);
    expect(metrics.sccs).toHaveLength(0);
    expect(metrics.acyclicNodes.size).toBe(3);
    expect(metrics.backEdges).toHaveLength(0);
  });

  it("should handle fully cyclic graph", () => {
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

    const metrics = analyzeGraph(instances, connections);

    expect(metrics.hasCycles).toBe(true);
    expect(metrics.sccs).toHaveLength(1);
    expect(metrics.acyclicNodes.size).toBe(0);
  });
});

describe("getPatternName", () => {
  it("should return correct names for all patterns", () => {
    expect(getPatternName(CircularPattern.SELF_LOOP)).toBe("Self-Loop");
    expect(getPatternName(CircularPattern.BIDIRECTIONAL)).toBe("Doubly-Linked");
    expect(getPatternName(CircularPattern.CIRCULAR_LIST)).toBe("Circular List");
    expect(getPatternName(CircularPattern.GENERAL_CYCLE)).toBe("Complex Cycle");
  });
});
