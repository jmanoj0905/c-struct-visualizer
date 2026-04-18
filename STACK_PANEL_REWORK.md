# Stack Panel Rework Specification

## Overview
This document outlines the complete redesign of the Stack Panel visualization in the C Struct Visualizer. The goal is to provide clear, consistent, and intuitive visualizations for all data types encountered in C/C++ debugging.

---

## 1. Variable Layout

### Current Behavior
- Variables displayed with name, type, and inline value
- Array/vector visualizations appear inline

### Target Behavior
- **Single row per variable**: Each variable takes exactly one line
- **Layout**: `[Name] [Type] [Value/Visualization]`
- All complex visualizations (arrays, vectors, stacks, structs) appear **inline** within the frame

---

## 2. Type-Specific Display Rules

### 2.1 Primitive Types (int, float, char, bool, double)

**Display Format**: Boxed with label
```
┌─────────────────────────┐
│ x    │ int    │ 42     │
└─────────────────────────┘
```

**Implementation**:
- Show variable name in monospace font
- Show type in smaller gray text
- Show value in bold monospace

### 2.2 Pointers

**Display Format**: Clickable colored dot
```
name    type        ● (colored)
```

**Implementation**:
- Show name and type inline
- Replace value with colored circular dot
- Dot color matches the heap object it points to
- Clicking/hoving the dot highlights the corresponding heap object in the Heap panel
- If NULL, show "NULL" text instead

### 2.3 One-Dimensional Arrays (int arr[5])

**Display Format**: Horizontal boxes with indices
```
arr    int[5]    [0] [1] [2] [3] [4]
              ┌───┬───┬───┬───┬───┐
              │ 1 │ 2 │ 3 │ 4 │ 5 │
              └───┴───┴───┴───┴───┘
```

**Implementation**:
- Each element in a bordered box
- Index label below each box
- Boxes colored green background
- If elements > 10, show first 5 + "+N more"

### 2.4 Two-Dimensional Arrays (int matrix[3][3])

**Display Format**: Matrix grid with row/column indices
```
matrix  int[3][3]
          0   1   2
        ┌───┬───┬───┐
    0   │ 1 │ 2 │ 3 │
        ├───┼───┼───┤
    1   │ 4 │ 5 │ 6 │
        ├───┼───┼───┤
    2   │ 7 │ 8 │ 9 │
        └───┴───┴───┘
```

**Implementation**:
- Column indices above the grid
- Row indices to the left of each row
- Each cell is a bordered box with blue background
- Indices in small gray text

### 2.5 Three-Dimensional and Higher Arrays

**Display Format**: Flattened linear boxes with indices
```
arr    int[2][3][4]
        [0]  [1]  [2]  [3]  [4]  [5]  [6]  [7]  ...
      ┌───┬───┬───┬───┬───┬───┬───┬───┐
      │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │ 8 │ ...
      └───┴───┴───┴───┴───┴───┴───┴───┘
```

**Implementation**:
- Same as 1D array but with higher index labels like [0,0,0], [0,0,1], etc.
- Purple background for 3D+ arrays
- Boxes wrap to multiple lines if needed

### 2.6 std::vector

**Display Format**: Same as 1D arrays with length/capacity info
```
prices  std::vector<int>
        len:5 cap:8
        [0] [1] [2] [3] [4]
      ┌───┬───┬───┬───┬───┐
      │ 7 │ 1 │ 5 │ 3 │ 6 │
      └───┴───┴───┴───┴───┘
```

**Implementation**:
- Same as 1D arrays (horizontal boxes)
- Show length and capacity in header
- Green background like 1D arrays

### 2.7 std::string

**Display Format**: Character boxes
```
name    std::string
        "hello"
        [h] [e] [l] [l] [o] [\0]
       ┌───┬───┬───┬───┬───┬───┐
       │ h │ e │ l │ l │ o │ \0│
       └───┴───┴───┴───┴───┴───┘
```

**Implementation**:
- Show quoted string inline first
- Below: character boxes for each character
- Each box shows the character and index
- Yellow background for null terminator
- Escape sequences displayed (e.g., \n, \t)

### 2.8 std::stack

**Display Format**: Vertical tube (like a real stack)
```
st      std::stack<int>
        size: 3  ● elements
        ┌─────────────┐
        │ [2] 30     │ ← TOP (highlighted)
        ├─────────────┤
        │ [1] 20     │
        ├─────────────┤
        │ [0] 10     │ ← BOTTOM
        └─────────────┘
```

**Implementation**:
- Header shows type and size
- "empty" or "N elements" status
- Vertical tube container with borders
- Elements stacked bottom-to-top (bottom = first pushed = index 0)
- Top element (last in) highlighted with different border
- Elements shown as numbered boxes inside the tube
- Maximum ~5 visible, "+N more" if overflow

### 2.9 std::queue

**Display Format**: Horizontal tube with front/back labels
```
q       std::queue<int>
        size: 3  ● elements
    FRONT                 BACK
    ┌───┬───┬───┐
    │ 1 │ 2 │ 3 │
    └───┴───┴───┘
```

**Implementation**:
- Header shows type and size
- "front" and "back" labels on either end
- Horizontal tube container
- Elements shown as boxes in order
- Front element highlighted

### 2.10 std::set and std::map

**Display Format**: Key-value boxes
```
s       std::set<int>
        { 1, 2, 3, 4, 5 }
        ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐
        │ 1 │ │ 2 │ │ 3 │ │ 4 │ │ 5 │
        └───┘ └───┘ └───┘ └───┘ └───┘

m       std::map<string,int>
        ┌────────┬─────┐
        │ "one"  │  1  │
        ├────────┼─────┤
        │ "two"  │  2  │
        └────────┴─────┘
```

**Implementation**:
- Set: Horizontal boxes like 1D array, orange background
- Map: Two-column boxes showing key-value pairs, table format
- Show all elements if < 10, else truncate

### 2.11 Structs/Classes

**Display Format**: Expandable fields
```
Node*   Node*
        {next: 0x1234, val: 42}
        ▼ next: 0x1234 ─────────────────┐
          val: 42                        │
                                         ▼ (points to next Node)
```

**Implementation**:
- Show struct name and address inline
- Below: show fields in indented format
- Nested structs/pointers shown with indentation
- Click to expand/collapse
- Pointers to heap objects show colored dots

---

## 3. Detection Logic

### Type Detection Order

1. **Pointers**: Check `v.isPointer` flag OR type contains `*`
2. **Arrays**: Check type contains `[N]` pattern
3. **std::vector**: Check type contains `vector<` or `std::vector`
4. **std::stack**: Check type contains `stack<` or `std::stack`
5. **std::queue**: Check type contains `queue<` or `std::queue`
6. **std::set**: Check type contains `set<` or `std::set`
7. **std::map**: Check type contains `map<` or `std::map`
8. **std::string**: Check type contains `string` or `std::string`
9. **Primitives**: Default fallback

### Array Dimension Detection

- Count `[N]` patterns in type string
- `int[5]` → dimension = 1
- `int[3][3]` → dimension = 2
- `int[2][3][4]` → dimension = 3

---

## 4. Value Parsing

### GDB Output Patterns

| Type | GDB Value Pattern | Parsing |
|------|------------------|---------|
| int[] | `{1, 2, 3, 4, 5}` | Split by comma |
| int[][] | `{{1,2,3},{4,5,6}}` | Split by nested braces |
| std::vector | `std::vector of length N, capacity N = {...}` | Extract from format |
| std::stack | `std::stack wrapping: std::deque with N elements = {...}` | Extract from format |
| std::string | `"hello world"` | Extract quoted string |

### Error Handling

- If value contains `<error reading value>`, show inline text instead of visualization
- If value contains `<optimized out>`, show that text
- If parsing fails, fall back to raw value display

---

## 5. Component Architecture

### File Structure
```
StackFramePanel.tsx
├── isStringValue()          - Check if type is string
├── isArrayLikeType()        - Check if type is array/vector
├── isStackType()            - Check if type is stack
├── isQueueType()            - Check if type is queue
├── isSetType()              - Check if type is set
├── isMapType()              - Check if type is map
├── parseArrayValue()        - Parse 1D array from string
├── parse2DArrayValue()      - Parse 2D array from string
├── parseVectorValue()       - Parse vector from string
├── parseStackValue()        - Parse stack from string
│
├── StringDisplay            - Component: character boxes
├── Array1DDisplay          - Component: horizontal boxes
├── Array2DDisplay          - Component: matrix grid
├── Array3DPlusDisplay      - Component: flattened boxes
├── StackVisualization       - Component: vertical tube
├── QueueVisualization      - Component: horizontal tube
├── SetDisplay              - Component: key boxes
├── MapDisplay              - Component: key-value table
├── StructDisplay           - Component: expandable fields
├── ValueWithPointers       - Component: clickable pointer dots
│
└── StackFramePanel         - Main component
    └── For each variable:
        ├── Detect type
        ├── Render appropriate visualization
        └── Handle pointer highlighting
```

---

## 6. Visual Design

### Color Scheme

| Element | Color | Background |
|---------|-------|------------|
| 1D Array/Vector | Green | bg-green-50 |
| 2D Array | Blue | bg-blue-50 |
| 3D+ Array | Purple | bg-purple-50 |
| std::stack | Orange | bg-orange-50 |
| std::queue | Cyan | bg-cyan-50 |
| std::set | Amber | bg-amber-50 |
| std::map | Indigo | bg-indigo-50 |
| String chars | Yellow | bg-yellow-50 |
| Top of stack | Green border | border-green-500 |
| Front of queue | Blue border | border-blue-500 |
| Active frame | Green left border | border-l-4 border-l-green-400 |

### Typography

- Variable name: `font-mono font-heading text-[11px]`
- Type: `font-mono text-[9px] text-gray-400`
- Values: `font-mono text-[10px] font-bold`
- Indices: `font-mono text-[7px] text-gray-400`
- Box borders: `border border-black/40 rounded-sm`

### Spacing

- Variable row padding: `px-1 py-0.5`
- Box gap: `gap-1` (horizontal), `gap-0.5` (vertical)
- Box size: `w-7 h-6` (small), `w-8 h-6` (medium)
- Index margin-top: `mt-0.5`

---

## 7. Implementation Checklist

- [x] Fix array detection to properly detect vectors
- [x] Fix 1D array display - horizontal boxes with indices
- [x] Fix 2D array display - matrix grid with indices
- [x] Fix 3D+ array display - flattened linear boxes
- [x] Redesign std::stack - vertical tube visualization
- [ ] Add std::queue - horizontal tube visualization
- [ ] Fix std::string - character boxes
- [ ] Add std::set - key boxes
- [ ] Add std::map - key-value table
- [ ] Add struct expandable view
- [x] Handle unreadable values gracefully
- [x] Add proper spacing and margins
- [ ] Test all edge cases

---

## 8. Edge Cases

### Empty Containers
- Empty stack/queue/set/map: Show empty container visualization with "empty" text

### Unreadable Values
- `<error reading value>`: Show inline text, no visualization
- `<optimized out>`: Show inline text

### Long Arrays
- More than 10 elements: Show first 5 + "+N more" indicator

### Complex Nested Types
- `vector<stack<int>>`: Show outer as vector, inner elements as stack boxes
- Pointer to array: Show pointer dot + array visualization

### Null Pointers
- NULL: Show "NULL" text instead of dot

---

## 9. Testing Scenarios

1. **Primitives**: `int x = 42;`, `char c = 'a';`, `bool b = true;`
2. **Pointers**: `int* p = &x;`, `Node* head = new Node();`
3. **1D Array**: `int arr[5] = {1,2,3,4,5};`
4. **2D Array**: `int matrix[3][3] = {{1,2,3},{4,5,6},{7,8,9}};`
5. **3D Array**: `int arr[2][3][4];`
6. **std::vector**: `vector<int> v = {1,2,3};`
7. **std::string**: `string s = "hello";`
8. **std::stack**: `stack<int> st; st.push(1); st.push(2);`
9. **std::queue**: `queue<int> q; q.push(1); q.push(2);`
10. **std::set**: `set<int> s = {1,2,3};`
11. **std::map**: `map<string,int> m = {{"one",1},{"two",2}};`
12. **Struct**: `struct Node { int val; Node* next; };`
13. **Empty containers**: `stack<int> empty;`
14. **NULL pointer**: `int* nullPtr = NULL;`
