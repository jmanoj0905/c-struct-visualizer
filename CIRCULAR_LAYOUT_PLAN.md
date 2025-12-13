# Circular Structure Layout Implementation Plan

## Overview
Enhance the auto-layout algorithm to detect and properly visualize circular data structures (circular linked lists, doubly-linked lists, graphs with cycles, trees with back-pointers).

## Problem Statement
Current Issues:
1. Circular references cause overlapping nodes in hierarchical layout
2. Back-edges (edges pointing backwards) cross over many other nodes
3. Doubly-linked lists create visual clutter with parallel edges
4. No visual distinction between acyclic and cyclic structures
5. Circular references warning appears but no special layout handling

## Goals
1. Detect strongly connected components (SCCs) in the graph
2. Apply specialized layouts for different circular patterns
3. Minimize edge crossings and overlaps
4. Provide visual feedback for circular structures
5. Maintain hierarchical layout for acyclic parts

---

## Phase 1: Graph Analysis and Detection

### 1.1 Implement Graph Analysis Utilities
**File**: `src/utils/graphAnalysis.ts` (new file)

**Functions to implement**:

```typescript
// Detect strongly connected components using Tarjan's algorithm
export function findStronglyConnectedComponents(
  instances: StructInstance[],
  connections: PointerConnection[]
): InstanceGroup[]

// Classify the type of circular structure
export enum CircularPattern {
  SELF_LOOP,           // A → A
  BIDIRECTIONAL,       // A ⇄ B
  CIRCULAR_LIST,       // A → B → C → A
  GENERAL_CYCLE,       // Complex cycle pattern
}

export function classifyCircularPattern(
  group: InstanceGroup,
  connections: PointerConnection[]
): CircularPattern

// Detect if two nodes form a doubly-linked pair
export function isDoublyLinkedPair(
  node1: string,
  node2: string,
  connections: PointerConnection[]
): boolean

// Find all back-edges (edges that point backwards in hierarchy)
export function findBackEdges(
  instances: StructInstance[],
  connections: PointerConnection[]
): PointerConnection[]

// Topological sort with cycle detection
export function topologicalSort(
  instances: StructInstance[],
  connections: PointerConnection[]
): { sorted: string[]; hasCycle: boolean }
```

**Data Structures**:
```typescript
interface InstanceGroup {
  ids: Set<string>;           // Instance IDs in this group
  pattern: CircularPattern;   // Type of circular pattern
  isStronglyConnected: boolean;
}

interface GraphMetrics {
  sccs: InstanceGroup[];      // All strongly connected components
  backEdges: PointerConnection[];
  acyclicNodes: Set<string>;  // Nodes not part of any cycle
  dagLayers: string[][];      // Layered structure of acyclic part
}
```

### 1.2 Tarjan's Algorithm Implementation
**Complexity**: O(V + E)

**Pseudocode**:
```
function tarjan(graph):
    index = 0
    stack = []
    indices = {}
    lowlinks = {}
    onStack = {}
    sccs = []
    
    function strongConnect(v):
        indices[v] = index
        lowlinks[v] = index
        index++
        stack.push(v)
        onStack[v] = true
        
        for each edge (v, w):
            if w not visited:
                strongConnect(w)
                lowlinks[v] = min(lowlinks[v], lowlinks[w])
            else if w on stack:
                lowlinks[v] = min(lowlinks[v], indices[w])
        
        if lowlinks[v] == indices[v]:
            scc = []
            repeat:
                w = stack.pop()
                onStack[w] = false
                scc.add(w)
            until w == v
            sccs.add(scc)
    
    for each vertex v:
        if v not visited:
            strongConnect(v)
    
    return sccs
```

---

## Phase 2: Layout Strategies for Different Patterns

### 2.1 Self-Loop Layout
**Pattern**: Single node with pointer to itself

**Strategy**:
- Keep node in hierarchical position
- Add curved bezier edge that loops out and back
- Edge styling: distinct color or dashed line

**Implementation**:
```typescript
function layoutSelfLoop(
  nodeId: string,
  position: { x: number; y: number }
): EdgeLayout {
  return {
    edgeType: 'bezier',
    controlPoints: [
      { x: position.x + 100, y: position.y - 80 },
      { x: position.x + 100, y: position.y + 80 },
    ],
    style: {
      stroke: '#FF6B6B',
      strokeDasharray: '5,5',
    }
  };
}
```

### 2.2 Bidirectional (Doubly-Linked) Layout
**Pattern**: Two nodes with pointers to each other (A ⇄ B)

**Strategy**:
- Keep hierarchical positioning
- Draw edges as parallel curved lines with small offset
- Or use single thick bidirectional edge with arrows on both ends

**Implementation**:
```typescript
function layoutDoublyLinked(
  node1: StructInstance,
  node2: StructInstance,
  connections: PointerConnection[]
): EdgeLayout[] {
  const forward = connections.find(c => 
    c.sourceInstanceId === node1.id && c.targetInstanceId === node2.id
  );
  const backward = connections.find(c => 
    c.sourceInstanceId === node2.id && c.targetInstanceId === node1.id
  );
  
  return [
    {
      ...forward,
      pathOptions: { offset: 15, curvature: 0.3 },
      style: { stroke: '#4ECDC4' }
    },
    {
      ...backward,
      pathOptions: { offset: -15, curvature: 0.3 },
      style: { stroke: '#4ECDC4' }
    }
  ];
}
```

### 2.3 Circular List Layout
**Pattern**: Ring structure (A → B → C → A)

**Strategy Option 1: Circular Arrangement**
- Arrange nodes in a circle/polygon
- Equal spacing between nodes
- Calculate radius based on node count

**Strategy Option 2: Hierarchical with Back-Edge**
- Keep A → B → C hierarchical
- Draw C → A as curved back-edge with large arc

**Implementation (Circular)**:
```typescript
function layoutCircularList(
  nodeIds: string[],
  centerX: number,
  centerY: number
): Map<string, { x: number; y: number }> {
  const positions = new Map();
  const nodeCount = nodeIds.length;
  const radius = Math.max(200, nodeCount * 80);
  const angleStep = (2 * Math.PI) / nodeCount;
  
  nodeIds.forEach((id, index) => {
    const angle = index * angleStep - Math.PI / 2; // Start from top
    positions.set(id, {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    });
  });
  
  return positions;
}
```

### 2.4 General Cycle Layout
**Pattern**: Complex cycles (multiple nodes, multiple cycles)

**Strategy**:
- Use force-directed layout for the cyclic component
- Or radial layout with cycle-breaking
- Highlight back-edges with different styling

**Implementation**:
```typescript
function layoutGeneralCycle(
  nodeIds: string[],
  connections: PointerConnection[],
  centerX: number,
  centerY: number
): Map<string, { x: number; y: number }> {
  // Use force simulation or radial layout
  // Break one edge per cycle to create spanning tree
  // Layout tree hierarchically
  // Add broken edges as curved back-edges
  
  const spanningTree = createSpanningTree(nodeIds, connections);
  const backEdges = findBackEdges(connections, spanningTree);
  
  // Layout spanning tree
  const treeLayout = layoutTree(spanningTree);
  
  // Mark back-edges for special rendering
  backEdges.forEach(edge => {
    edge.isBackEdge = true;
    edge.style = {
      stroke: '#FFA500',
      strokeDasharray: '8,4',
      strokeWidth: 3,
    };
  });
  
  return treeLayout;
}
```

---

## Phase 3: Integration with Auto-Layout

### 3.1 Enhanced handleCleanupLayout Function
**File**: `src/App.tsx`

**Modified Flow**:
```typescript
async function handleCleanupLayout() {
  if (instances.length === 0) return;
  
  // Step 1: Analyze graph structure
  const metrics = analyzeGraph(instances, connections);
  
  // Step 2: Separate components
  const {
    sccs,           // Strongly connected components
    acyclicNodes,   // Nodes not in any cycle
    backEdges,      // Edges pointing backwards
  } = metrics;
  
  // Step 3: Layout acyclic part using ELK hierarchical
  const acyclicLayout = await layoutAcyclicPart(
    acyclicNodes,
    connections.filter(c => !isBackEdge(c, backEdges))
  );
  
  // Step 4: Layout each SCC based on its pattern
  const sccLayouts = await Promise.all(
    sccs.map(async (scc) => {
      switch (scc.pattern) {
        case CircularPattern.SELF_LOOP:
          return layoutSelfLoop(scc);
        case CircularPattern.BIDIRECTIONAL:
          return layoutDoublyLinked(scc);
        case CircularPattern.CIRCULAR_LIST:
          return layoutCircularList(scc);
        case CircularPattern.GENERAL_CYCLE:
          return layoutGeneralCycle(scc);
      }
    })
  );
  
  // Step 5: Combine layouts with proper spacing
  const finalLayout = combineLayouts(
    acyclicLayout,
    sccLayouts,
    { horizontalGap: 400, verticalGap: 300 }
  );
  
  // Step 6: Apply positions and update edge styling
  applyLayout(finalLayout);
  applyBackEdgeStyling(backEdges);
}
```

### 3.2 Layout Combination Strategy
```typescript
function combineLayouts(
  acyclicLayout: LayoutResult,
  sccLayouts: LayoutResult[],
  spacing: { horizontalGap: number; verticalGap: number }
): Map<string, { x: number; y: number }> {
  
  const finalPositions = new Map();
  
  // Start with acyclic layout on the left
  let currentX = 0;
  let maxY = 0;
  
  // Add acyclic nodes
  acyclicLayout.positions.forEach((pos, id) => {
    finalPositions.set(id, pos);
    maxY = Math.max(maxY, pos.y);
  });
  
  // Add SCCs to the right with proper spacing
  currentX = acyclicLayout.bounds.maxX + spacing.horizontalGap;
  
  sccLayouts.forEach((sccLayout, index) => {
    sccLayout.positions.forEach((pos, id) => {
      finalPositions.set(id, {
        x: pos.x + currentX,
        y: pos.y,
      });
    });
    
    // Move to next column for next SCC
    currentX += sccLayout.bounds.width + spacing.horizontalGap;
  });
  
  return finalPositions;
}
```

---

## Phase 4: Visual Enhancements

### 4.1 Edge Styling for Cycles
**File**: `src/App.tsx` (in edge creation)

**Enhancements**:
```typescript
const reactFlowEdges: Edge[] = connections.map((conn) => {
  const isBackEdge = backEdges.some(be => be.id === conn.id);
  const isInCycle = cycleEdges.has(conn.id);
  
  return {
    id: conn.id,
    source: conn.sourceInstanceId,
    target: conn.targetInstanceId,
    type: "custom",
    animated: isInCycle,
    style: {
      stroke: isBackEdge ? "#FFA500" : isInCycle ? "#FF6B6B" : "#374151",
      strokeWidth: isInCycle ? 4 : 3,
      strokeDasharray: isBackEdge ? "8,4" : "0",
    },
    markerEnd: {
      type: "arrowclosed",
      color: isBackEdge ? "#FFA500" : isInCycle ? "#FF6B6B" : "#374151",
    },
    data: { 
      connectionId: conn.id,
      isBackEdge,
      isInCycle,
    },
  };
});
```

### 4.2 Node Badges for Cycles
**File**: `src/components/StructNode.tsx`

**Add cycle indicator**:
```typescript
// Add to StructNode data
interface StructNodeData {
  // ... existing fields
  isInCycle?: boolean;
  cyclePattern?: CircularPattern;
}

// In StructNode component
{data.isInCycle && (
  <div className="absolute -top-2 -right-2 bg-[#FF6B6B] border-2 border-black rounded-full p-1">
    <RotateCw size={16} strokeWidth={2.5} className="text-white" />
  </div>
)}
```

### 4.3 Cycle Information Display
**New Component**: `src/components/CycleInfo.tsx`

**Features**:
- Shows list of detected cycles
- Click to highlight cycle
- Shows cycle type and node count

```typescript
interface CycleInfoProps {
  cycles: InstanceGroup[];
  onCycleClick: (cycleIds: string[]) => void;
}

function CycleInfo({ cycles, onCycleClick }: CycleInfoProps) {
  if (cycles.length === 0) return null;
  
  return (
    <div className="fixed top-20 right-4 bg-white border-4 border-black p-3 rounded-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
      <h3 className="text-sm font-bold mb-2">Cycles Detected: {cycles.length}</h3>
      <div className="space-y-2">
        {cycles.map((cycle, index) => (
          <button
            key={index}
            onClick={() => onCycleClick(Array.from(cycle.ids))}
            className="w-full text-left px-2 py-1 text-xs bg-[#FFE5D9] border-2 border-black hover:bg-[#FFCCBC] transition"
          >
            <div className="font-bold">{getPatternName(cycle.pattern)}</div>
            <div className="text-gray-600">{cycle.ids.size} nodes</div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

## Phase 5: Testing Strategy

### 5.1 Test Cases

**Test Case 1: Self-Loop**
```c
struct Node {
  int data;
  Node* self;
};
// Create instance, connect self → self
```

**Test Case 2: Doubly-Linked List**
```c
struct DNode {
  int data;
  DNode* next;
  DNode* prev;
};
// Create A, B, C
// Connect A.next → B, B.prev → A
// Connect B.next → C, C.prev → B
```

**Test Case 3: Circular List**
```c
struct Node {
  int data;
  Node* next;
};
// Create A, B, C
// Connect A → B → C → A
```

**Test Case 4: Tree with Back-Pointer**
```c
struct TreeNode {
  int data;
  TreeNode* left;
  TreeNode* right;
  TreeNode* parent;
};
// Create tree structure with parent pointers
```

**Test Case 5: Complex Graph**
```c
struct GraphNode {
  int id;
  GraphNode* neighbors[3];
};
// Create graph with multiple cycles
```

### 5.2 Expected Results
- No overlapping nodes
- Cycles clearly visible
- Back-edges distinguishable
- Minimal edge crossings
- Layout completes in < 2 seconds

---

## Implementation Timeline

### Week 1: Foundation
- [x] Create `graphAnalysis.ts` with basic utilities
- [x] Implement Tarjan's algorithm for SCC detection
- [x] Add pattern classification logic
- [x] Write unit tests for graph analysis

### Week 2: Layout Algorithms
- [x] Implement self-loop layout
- [x] Implement doubly-linked layout
- [x] Implement circular list layout
- [x] Implement general cycle layout
- [x] Test each layout independently

### Week 3: Integration
- [x] Modify `handleCleanupLayout` to use new analysis
- [x] Implement layout combination logic
- [ ] Add edge styling for cycles and back-edges
- [ ] Test with all test cases

### Week 4: Polish
- [ ] Add node badges for cycle indicators
- [ ] Create CycleInfo component
- [ ] Performance optimization
- [ ] Documentation and examples

---

## Performance Considerations

### Complexity Analysis
- **Tarjan's Algorithm**: O(V + E)
- **Pattern Classification**: O(E)
- **Circular Layout**: O(V)
- **Overall**: O(V + E) - linear time

### Optimization Strategies
1. **Caching**: Cache SCC results until graph changes
2. **Incremental Updates**: Only recompute affected components
3. **Lazy Evaluation**: Compute layouts on-demand
4. **Web Workers**: Offload heavy computation for large graphs

### Memory Usage
- **SCC Storage**: O(V) for tracking components
- **Graph Representation**: O(V + E) adjacency list
- **Layout Cache**: O(V) for position storage

---

## Future Enhancements

1. **Interactive Cycle Editing**
   - Click to break cycle at specific edge
   - Drag to reorder nodes in circular layout

2. **Animation**
   - Animate transition from hierarchical to circular layout
   - Flow animation along cycle edges

3. **Cycle Statistics**
   - Average cycle length
   - Most complex cycle
   - Cycle overlap visualization

4. **Export with Cycle Annotations**
   - Mark cycles in exported code
   - Generate documentation for circular structures

5. **Layout Preferences**
   - User choice between layout strategies
   - Save preferred layout per project

---

## Risk Mitigation

### Potential Issues

1. **Very Large Cycles** (>20 nodes)
   - **Mitigation**: Use radial layout with pagination/zoom

2. **Multiple Overlapping Cycles**
   - **Mitigation**: Color-code different cycles, layer separation

3. **Performance with 100+ nodes**
   - **Mitigation**: Progressive layout, virtual rendering

4. **Edge Crossing Minimization**
   - **Mitigation**: Use ELK's built-in crossing minimization

---

## Conclusion

This plan provides a comprehensive approach to handling circular structures in the C Struct Visualizer. The implementation focuses on:

1. **Correctness**: Proper detection of all cycle types
2. **Performance**: Linear time algorithms
3. **Usability**: Clear visual distinction of cycles
4. **Maintainability**: Modular, testable code

The phased approach allows for incremental delivery of value while maintaining code quality.
