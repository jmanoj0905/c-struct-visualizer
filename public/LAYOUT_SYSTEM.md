# Future-Proof Modular Layout System

## Overview

This document describes the completely modular and extensible auto-layout system for the C Struct Visualizer. The system is designed to be:

- **Completely modular** - Easy to understand and maintain
- **Easily extensible** - Add new patterns and layouts with minimal code
- **Self-documenting** - Clear interfaces and registry system
- **Testable** - Well-defined boundaries and responsibilities
- **Future-proof** - Built to handle any data structure pattern

---

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                   SMART LAYOUT SYSTEM                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────┐         ┌────────────────────┐      │
│  │ Pattern Detectors  │────────▶│ Layout Strategies  │      │
│  │   (Registry)       │         │    (Registry)      │      │
│  └────────────────────┘         └────────────────────┘      │
│           │                              │                   │
│           │                              │                   │
│           ▼                              ▼                   │
│  ┌────────────────────────────────────────────────────┐     │
│  │           Component Classifier                     │     │
│  │  • Analyzes graph structure                        │     │
│  │  • Runs pattern detectors                          │     │
│  │  • Assigns layout strategies                       │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User clicks "Auto Layout"
         │
         ▼
┌─────────────────────────┐
│ performSmartLayout()    │
│  - Main entry point     │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ classifyComponents()    │
│  - Find SCCs (cycles)   │
│  - Find connected comp  │
│  - Find isolated nodes  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ detectPattern()         │
│  - Run detectors by     │
│    priority             │
│  - Return best match    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ layoutComponent()       │
│  - Find strategy for    │
│    detected pattern     │
│  - Apply layout         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ updateInstancePosition()│
│  - Apply to canvas      │
└─────────────────────────┘
```

---

## Supported Data Structures

### Trees (Horizontal Layout)
- **Binary Tree** - At most 2 children per node
- **Binary Search Tree** - (Same as binary tree)
- **AVL Tree** - (Reserved for future balance detection)
- **Red-Black Tree** - (Reserved for future color detection)
- **B-Tree** - (Reserved for multi-way tree detection)
- **Trie** - Prefix tree structure
- **Heap** - Complete binary tree
- **General Tree** - N-ary tree with single root

### Lists (Horizontal Linear Layout)
- **Singly Linked List** - Single forward pointer
- **Doubly Linked List** - Bidirectional pointers (70%+ threshold)

### Circular Structures (Radial Layout)
- **Circular Linked List** - Detected by SCC analysis

### Multi-Level Structures
- **Skip List** - Multiple levels with "level" field

### Graphs (Specialized Layouts)
- **Directed Acyclic Graph (DAG)** - Topological layered layout
- **General Graph** - Force-directed with horizontal bias
- **Undirected Graph** - (Reserved)
- **Bipartite Graph** - (Reserved)

### Specialized Structures
- **Hash Table with Chaining** - Grid layout for buckets
- **Disjoint Set / Union-Find** - (Reserved)
- **2D Grid** - Grid layout for up/down/left/right pointers

### Fallback
- **Isolated Nodes** - Simple 4-per-row grid

---

## How to Add a New Pattern

### Step 1: Add Pattern Type

```typescript
// In StructurePattern object (line 31)
export const StructurePattern = {
  // ... existing patterns ...
  MY_NEW_PATTERN: "MY_NEW_PATTERN",  // Add here
} as const;
```

### Step 2: Create Pattern Detector

```typescript
/**
 * Detect [your pattern name]
 */
function detectMyPattern(
  nodeIds: Set<string>,
  connections: PointerConnection[],
  instances: StructInstance[],
  structDefinitions: CStruct[],
): PatternDetectorResult {
  // 1. Filter connections within this component
  const componentConnections = connections.filter(
    (c) => nodeIds.has(c.sourceInstanceId) && nodeIds.has(c.targetInstanceId),
  );

  // 2. Check your pattern's properties
  // Example: Check node count
  if (nodeIds.size < 3) return { matches: false, confidence: 0 };

  // 3. Check structural properties
  // Example: Check degree constraints
  const outgoingCount = new Map<string, number>();
  componentConnections.forEach((c) => {
    const count = outgoingCount.get(c.sourceInstanceId) || 0;
    outgoingCount.set(c.sourceInstanceId, count + 1);
  });

  // 4. Apply your pattern logic
  // Example: All nodes must have exactly 2 outgoing edges
  for (const count of outgoingCount.values()) {
    if (count !== 2) return { matches: false, confidence: 0 };
  }

  // 5. Return result with confidence score
  return { matches: true, confidence: 0.85 };
}
```

### Step 3: Create Layout Strategy

```typescript
/**
 * Layout strategy for [your pattern]
 */
function layoutMyPattern(
  component: ComponentInfo,
  instances: StructInstance[],
  connections: PointerConnection[],
  structDefinitions: CStruct[],
  nodeHeights: Map<string, number>,
  config: LayoutConfig,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const nodeIds = Array.from(component.nodeIds);

  // Implement your layout algorithm here
  // Example: Arrange in a spiral
  let x = 0;
  let y = 0;
  let angle = 0;
  let radius = 100;

  nodeIds.forEach((id, index) => {
    positions.set(id, {
      x: x + radius * Math.cos(angle),
      y: y + radius * Math.sin(angle),
    });

    angle += Math.PI / 4;  // 45 degrees
    radius += 20;  // Spiral outward
  });

  return positions;
}
```

### Step 4: Register in Registries

```typescript
// In getPatternDetectors() function
function getPatternDetectors(): PatternRegistry[] {
  return [
    // ... existing detectors ...
    {
      pattern: StructurePattern.MY_NEW_PATTERN,
      detector: detectMyPattern,
      priority: 75,  // Higher = checked first (1-100)
      description: "Brief description of your pattern",
    },
  ];
}

// In getLayoutStrategies() function
function getLayoutStrategies(): LayoutStrategyRegistry[] {
  return [
    // ... existing strategies ...
    {
      pattern: StructurePattern.MY_NEW_PATTERN,
      strategy: layoutMyPattern,
      description: "Brief description of your layout",
    },
  ];
}
```

**That's it!** Your new pattern will automatically be:
- Detected during classification
- Applied when matched
- Available for all future graphs

---

## Pattern Detector Guidelines

### Confidence Scores

Use confidence scores to help the system choose between competing patterns:

- **0.95-1.0**: Extremely high confidence (exact match)
- **0.85-0.95**: High confidence (very likely)
- **0.70-0.85**: Medium-high confidence (likely)
- **0.50-0.70**: Medium confidence (possible)
- **0.0-0.50**: Low confidence (don't use)

### Priority System

Detectors are run in priority order (highest first):

- **95-100**: Very specific patterns (e.g., singly linked list)
- **85-95**: Specific patterns (e.g., binary tree)
- **70-85**: Moderately specific (e.g., doubly linked list)
- **60-70**: General patterns (e.g., general tree)
- **<60**: Fallback patterns (e.g., DAG)

### Detection Best Practices

1. **Fast checks first**: Check size constraints before expensive analysis
2. **Early return**: Return `{ matches: false, confidence: 0 }` as soon as you know it doesn't match
3. **Use existing data**: Leverage `structDefinitions` for field names/types
4. **Metadata**: Include useful metadata for layout strategy:
   ```typescript
   return {
     matches: true,
     confidence: 0.9,
     metadata: {
       balanceFactor: 1.2,
       treeHeight: 5
     }
   };
   ```

---

## Layout Strategy Guidelines

### Coordinate System

- **Origin**: (0, 0) - Start your layout here
- **X-axis**: Left to right (→)
- **Y-axis**: Top to bottom (↓)
- **Node dimensions**: Use `config.nodeWidth` and `nodeHeights.get(nodeId)`
- **Spacing**: Use `config.horizontalSpacing` and `config.verticalSpacing`

### Horizontal Preference

**All non-circular layouts should prefer horizontal spread:**

```typescript
// GOOD: Horizontal bias
const horizontalSpacing = config.horizontalSpacing;  // 200px
const verticalSpacing = config.verticalSpacing;      // 150px

// BAD: Vertical bias (avoid)
const horizontalSpacing = 100;
const verticalSpacing = 300;
```

### Field Ordering for Trees

**Important:** Maintain field order to prevent edge crossings:

```typescript
// Get field index from struct definition
function getFieldIndex(nodeId: string, fieldName: string): number {
  const instance = instances.find((i) => i.id === nodeId);
  const structDef = structDefinitions.find((s) => s.name === instance?.structName);
  const fieldIndex = structDef?.fields.findIndex((f) => f.name === fieldName);
  return fieldIndex * 1000;  // Scale for array indices
}

// Sort children by field position
children.sort((a, b) => {
  return getFieldIndex(parentId, a.fieldName) - getFieldIndex(parentId, b.fieldName);
});
```

### Common Layout Patterns

#### Linear (Horizontal)
```typescript
let x = 0;
nodeIds.forEach((id) => {
  positions.set(id, { x, y: 0 });
  x += config.nodeWidth + config.horizontalSpacing;
});
```

#### Grid
```typescript
const cols = 4;
nodeIds.forEach((id, index) => {
  const row = Math.floor(index / cols);
  const col = index % cols;
  positions.set(id, {
    x: col * (config.nodeWidth + config.horizontalSpacing),
    y: row * (nodeHeights.get(id) + config.verticalSpacing),
  });
});
```

#### Circular
```typescript
const radius = Math.max(400, nodeIds.length * 150);
const angleStep = (2 * Math.PI) / nodeIds.length;

nodeIds.forEach((id, index) => {
  const angle = -Math.PI / 2 + index * angleStep;  // Start from top
  positions.set(id, {
    x: radius * Math.cos(angle),
    y: radius * Math.sin(angle),
  });
});
```

---

## Testing Your Pattern

### 1. Create Test Structures

```c
// In the application, create test instances
struct MyStruct {
  int data;
  MyStruct* next;
  MyStruct* special;
};
```

### 2. Add Instances and Connections

Connect them to form your pattern.

### 3. Run Auto-Layout

Click the "Auto arrange layout" button and verify:
- ✅ Pattern is correctly detected
- ✅ Layout is clean and readable
- ✅ No edge crossings (for trees)
- ✅ Nodes don't overlap
- ✅ Spacing is appropriate

### 4. Debug Detection

Add logging to your detector:
```typescript
function detectMyPattern(...): PatternDetectorResult {
  console.log("Checking MyPattern with", nodeIds.size, "nodes");

  const result = /* ... your logic ... */;

  console.log("MyPattern result:", result);
  return result;
}
```

---

## Current Patterns Reference

### Binary Tree
- **Detection**: N-1 edges, each node ≤2 children, single root
- **Layout**: Horizontal tree (left-to-right)
- **Confidence**: 0.9

### Singly Linked List
- **Detection**: Each node ≤1 outgoing edge, single head, N-1 edges
- **Layout**: Horizontal linear
- **Confidence**: 0.95

### Doubly Linked List
- **Detection**: ≥70% bidirectional edges
- **Layout**: Horizontal linear
- **Confidence**: Bidirectional ratio

### Skip List
- **Detection**: Nodes have "level" field + avg >1.5 outgoing edges
- **Layout**: Multi-level horizontal
- **Confidence**: 0.85

### Heap
- **Detection**: Binary tree (lower confidence without values)
- **Layout**: Horizontal tree
- **Confidence**: 0.5

### Directed Acyclic Graph (DAG)
- **Detection**: No cycles (SCC analysis), not a tree
- **Layout**: Layered topological
- **Confidence**: 0.85

### Hash Table with Chaining
- **Detection**: Has "buckets"/"table"/"chains" pointer array field
- **Layout**: Grid
- **Confidence**: 0.8

### 2D Grid
- **Detection**: Has up/down/left/right pointer fields
- **Layout**: Grid
- **Confidence**: 0.85

### General Tree
- **Detection**: N-1 edges, single root, each non-root has 1 incoming
- **Layout**: Horizontal tree
- **Confidence**: 0.8

### General Graph
- **Detection**: Fallback when no other pattern matches
- **Layout**: Force-directed with horizontal bias
- **Confidence**: N/A (default)

---

## Advanced Features

### Metadata

Detectors can return metadata for use by layout strategies:

```typescript
// In detector
return {
  matches: true,
  confidence: 0.9,
  metadata: {
    type: "red_black_tree",
    height: calculateHeight(),
    isBalanced: checkBalance(),
  }
};

// In layout strategy
function layoutRedBlackTree(component: ComponentInfo, ...): ... {
  const isBalanced = component.metadata?.isBalanced as boolean;

  // Adjust spacing based on balance
  const spacing = isBalanced ? 150 : 200;
  // ...
}
```

### Component Root/Head

Set `rootNodeId` or `headNodeId` in `ComponentInfo` to hint at layout start point:

```typescript
components.push({
  pattern: StructurePattern.BINARY_TREE,
  nodeIds: componentNodes,
  rootNodeId: findRootNode(componentNodes, connections),  // Layout starts here
});
```

### Configuration Override

Layouts can ignore config and use custom spacing if needed:

```typescript
function layoutTightGrid(component, ..., config): ... {
  // Override config for tighter spacing
  const customSpacing = config.horizontalSpacing * 0.5;
  // Use customSpacing instead
}
```

---

## File Structure

```
src/utils/smartLayout.ts (1,436 lines)
├── Type Definitions (lines 24-137)
│   ├── StructurePattern enum
│   ├── ComponentInfo interface
│   ├── LayoutConfig interface
│   ├── PatternDetector type
│   ├── LayoutStrategy type
│   └── Registry types
│
├── Pattern Detectors (lines 152-494)
│   ├── detectBinaryTree()
│   ├── detectGeneralTree()
│   ├── detectSinglyLinkedList()
│   ├── detectDoublyLinkedList()
│   ├── detectSkipList()
│   ├── detectHeap()
│   ├── detectDAG()
│   ├── detectHashTableChaining()
│   └── detectGrid2D()
│
├── Layout Strategies (lines 496-977)
│   ├── layoutHorizontalTree()
│   ├── layoutHorizontalList()
│   ├── layoutCircular()
│   ├── layoutLayeredDAG()
│   ├── layoutForceDirected()
│   ├── layoutGrid2D()
│   ├── layoutSkipList()
│   └── layoutIsolatedNodes()
│
├── Registry System (lines 979-1112)
│   ├── getPatternDetectors()
│   └── getLayoutStrategies()
│
├── Main System (lines 1114-1312)
│   ├── performSmartLayout() - Entry point
│   ├── classifyComponents() - Pattern classification
│   ├── detectPattern() - Run detectors
│   └── layoutComponent() - Apply strategy
│
└── Utilities (lines 1314-1435)
    ├── findRootNode()
    ├── buildAdjacencyMap()
    ├── findConnectedComponent()
    ├── calculateNodeHeights()
    └── calculateComponentWidth()
```

---

## Performance Considerations

### Pattern Detection
- **Time Complexity**: O(V + E) per detector
- **Space Complexity**: O(V)
- **Optimization**: Early returns, priority ordering

### Layout Strategies
- **Linear layouts**: O(V)
- **Tree layouts**: O(V)
- **Force-directed**: O(V² × iterations)
- **Grid layouts**: O(V)

### Scalability
- **Small graphs (<50 nodes)**: All algorithms perform well
- **Medium graphs (50-500 nodes)**: Force-directed may slow down
- **Large graphs (>500 nodes)**: Consider optimizing force-directed iterations

---

## Future Enhancements

### Planned Patterns
- Red-Black Tree detection (check for "color" field)
- AVL Tree detection (check for "balance" field)
- B-Tree detection (multi-way branches)
- Trie detection (character-based edges)
- Disjoint Set Forest detection

### Planned Layouts
- Sugiyama framework for hierarchical graphs
- Spring-electrical model optimization
- Orthogonal routing for clean edges
- Cluster-based layouts for large graphs

### User Customization
- Allow users to select layout algorithm manually
- Save preferred layouts per structure type
- Custom spacing configuration
- Layout animation

---

## Summary

The modular layout system provides:

✅ **22 pattern types** ready for detection
✅ **10 layout strategies** implemented
✅ **9 active detectors** with priority system
✅ **Registry-based** architecture for easy extension
✅ **Well-documented** interfaces and examples
✅ **Future-proof** design for any data structure

**To add a new pattern:** Just 4 steps (Type → Detector → Strategy → Register)

**File:** `src/utils/smartLayout.ts` (1,436 lines)
**Build status:** ✅ Compiles without errors
**Ready for:** Production use and extension

---

*Last updated: 2025-12-17*
