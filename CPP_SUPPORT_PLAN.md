# C++ Support Plan

**Version**: 2.1.0 Target
**Status**: Proposed
**Author**: Generated from codebase analysis
**Date**: 2026-02-08

---

## 1. Overview

This document describes the plan to extend the C Struct Visualizer with C++ support across both **Free Mode** (interactive canvas) and **Visualizer Mode** (code stepping). The goal is to let users define and visualize C++ classes — including inheritance, methods, constructors/destructors, virtual dispatch, and `new`/`delete` — while preserving the existing C functionality unchanged.

### Design Principles

- **Additive, not breaking** — all existing C code continues to work exactly as before.
- **Educational focus** — support the subset of C++ that matters for teaching data structures and OOP, not the full language.
- **Visualize what matters** — inheritance hierarchies, vtable pointers, object lifecycles, and method calls should all be _visible_ on the canvas and in the stack panel.

---

## 2. Scope

### In Scope

| Feature | Free Mode | Visualizer Mode |
|---|---|---|
| `class` keyword (equivalent to struct with default private) | Yes | Yes |
| Access specifiers (`public`, `private`, `protected`) | Yes (visual) | Yes (enforced) |
| Single inheritance (`: public Base`) | Yes | Yes |
| Constructors & destructors | Visual only | Full execution |
| Virtual methods & vtable | Visual only | Full dispatch |
| `this` pointer | N/A | Yes |
| `new` / `delete` operators | N/A | Yes |
| `nullptr` keyword | N/A | Yes |
| Method declarations & definitions | Yes | Yes |
| Member initializer lists (`: field(val)`) | N/A | Yes |
| References (`int&`) | Yes (type display) | Yes |
| `const` methods | Yes (visual) | Yes (enforced) |
| `std::string` (simplified) | N/A | Yes |
| `std::vector<T>` (simplified) | N/A | Yes |
| `cout` / `cin` I/O | N/A | Yes |
| C++ templates for built-in sidebar data structures | Yes | N/A |

### Out of Scope

These features add enormous complexity with limited educational payoff:

- Multiple inheritance and virtual inheritance
- Full C++ templates / generic programming
- Operator overloading (beyond assignment)
- Exception handling (`try`/`catch`/`throw`)
- Move semantics and rvalue references
- Lambdas and closures
- RTTI (`dynamic_cast`, `typeid`)
- Namespaces (beyond `std::`)
- Preprocessor macros
- Modules, concepts, coroutines (C++20/23)
- `constexpr`, `consteval`
- `friend` classes/functions
- Nested classes

---

## 3. Current Architecture Summary

### File Map

```
src/
├── parser/
│   └── structParser.ts          # Free mode: parses struct definitions
├── engine/
│   ├── traceRunner.ts           # Entry point: code → ExecutionStep[]
│   ├── heapMapper.ts            # HeapObject[] → ReactFlow nodes
│   └── interpreter/
│       ├── lexer.ts             # Tokenizer (keywords, literals, punctuation)
│       ├── parser.ts            # Recursive descent → AST
│       ├── ast.ts               # AST node types + CType definition
│       ├── interpreter.ts       # AST walker → execution trace
│       ├── memory.ts            # Stack frames + heap allocation
│       └── builtins.ts          # printf, scanf, malloc, free, etc.
├── types/
│   ├── index.ts                 # CStruct, CField, StructInstance, etc.
│   └── visualizer.ts            # ExecutionStep, HeapObject, VariableSnapshot
├── store/
│   ├── canvasStore.ts           # Free mode state (Zustand)
│   └── visualizerStore.ts       # Visualizer mode state (Zustand)
├── components/
│   ├── StructEditor.tsx         # Free mode struct definition editor
│   ├── Sidebar.tsx              # Free mode sidebar + templates
│   ├── PointerMenu.tsx          # Free mode pointer panel
│   ├── StructNode.tsx           # ReactFlow struct card renderer
│   └── visualizer/
│       ├── HeapCanvas.tsx       # Heap visualization (ReactFlow)
│       ├── StackFramePanel.tsx  # Variable table
│       ├── ConsoleOutput.tsx    # stdin/stdout
│       └── CodeEditorPanel.tsx  # Code editor + run/stop
└── utils/
    └── smartLayout.ts           # Topology-aware graph layout
```

### Key Data Structures

```typescript
// Current struct definition (types/index.ts)
interface CStruct {
  name: string;
  typedef?: string;
  fields: CField[];
  color?: string;
}

// Current type representation (engine/interpreter/ast.ts)
interface CType {
  base: string;          // "int", "struct Node", etc.
  pointerLevel: number;
  isStruct: boolean;
  arraySize?: number;
}

// Current heap object (types/visualizer.ts)
interface HeapObject {
  address: number;
  typeName: string;
  isStruct: boolean;
  fields: Record<string, { value: number | null; isPointer: boolean; pointsTo?: number | null }>;
  freed: boolean;
}
```

---

## 4. Implementation Phases

### Phase 1: Lexer & Type System Foundation

**Goal**: Recognize C++ tokens and represent classes in the type system.

#### 4.1.1 — Extend the Lexer

**File**: `src/engine/interpreter/lexer.ts`

Add C++ keywords to the keyword set:

```
class, public, private, protected, virtual, override, final,
nullptr, new, delete, this, bool, true, false, using, namespace,
cout, cin, endl, string, vector
```

No structural changes needed — the lexer already emits `Keyword` tokens for anything in the keyword set.

**Estimated change**: ~10 lines.

#### 4.1.2 — Extend CType

**File**: `src/engine/interpreter/ast.ts`

```typescript
interface CType {
  base: string;
  pointerLevel: number;
  isStruct: boolean;
  isClass: boolean;          // NEW: true for class types
  isReference: boolean;      // NEW: true for T& reference types
  isConst: boolean;          // NEW: true for const-qualified
  arraySize?: number;
}
```

Update `typeSize()` and `typeToString()` to handle the new flags. A class has the same layout as a struct plus a hidden `__vptr` field when it has virtual methods.

**Estimated change**: ~30 lines.

#### 4.1.3 — Extend CStruct / Create CClass

**File**: `src/types/index.ts`

```typescript
// Extend CField
interface CField {
  name: string;
  type: string;
  isPointer: boolean;
  isArray: boolean;
  arraySize?: number;
  pointerLevel?: number;
  isFunctionPointer?: boolean;
  accessLevel?: "public" | "private" | "protected";  // NEW
  isStatic?: boolean;                                  // NEW
}

// New: method representation
interface CMethod {
  name: string;
  returnType: string;
  parameters: { name: string; type: string }[];
  accessLevel: "public" | "private" | "protected";
  isVirtual: boolean;
  isConst: boolean;
  isStatic: boolean;
  isPureVirtual: boolean;     // = 0
  isConstructor: boolean;
  isDestructor: boolean;
}

// Extend CStruct to support class features
interface CStruct {
  name: string;
  typedef?: string;
  fields: CField[];
  color?: string;
  isClass?: boolean;                             // NEW
  baseClass?: string;                            // NEW: single inheritance
  methods?: CMethod[];                           // NEW
  accessDefault?: "public" | "private";          // NEW: struct=public, class=private
}
```

This keeps `CStruct` as the single type for both structs and classes. A class is just a struct with `isClass: true` and `accessDefault: "private"`.

**Estimated change**: ~50 lines.

#### 4.1.4 — Extend HeapObject & VariableSnapshot

**File**: `src/types/visualizer.ts`

```typescript
interface HeapObject {
  // ... existing fields
  className?: string;           // NEW: class name if C++ object
  hasVtable?: boolean;          // NEW: whether object has vtable pointer
  baseClassFields?: string[];   // NEW: fields inherited from base class
}

interface VariableSnapshot {
  // ... existing fields
  isReference?: boolean;        // NEW: for T& references
  isConst?: boolean;            // NEW
}
```

**Estimated change**: ~15 lines.

---

### Phase 2: Parser — Class Definitions & Methods

**Goal**: Parse `class` definitions, methods, inheritance, and access specifiers.

#### 4.2.1 — Free Mode Parser (`structParser.ts`)

**File**: `src/parser/structParser.ts`

Extend `parseStruct()` to handle:

```cpp
// Basic class
class Node {
public:
    int data;
    Node* next;
    Node(int d);           // constructor declaration
    ~Node();               // destructor declaration
    int getData() const;   // method declaration
private:
    int _secret;
};

// Class with inheritance
class LinkedList : public Node {
public:
    int length;
    void insert(int val);
    virtual void print();
};
```

**Changes needed**:

1. **Detect `class` keyword** alongside `struct`:
   - After `class`, parse optional identifier, optional `: public BaseClass`, then `{`.
   - Track current access level (default `private` for class, `public` for struct).

2. **Parse access specifier labels** (`public:`, `private:`, `protected:`):
   - When a line matches `/^\s*(public|private|protected)\s*:/`, update the current access level.
   - All subsequent fields/methods inherit this level until the next specifier.

3. **Parse method declarations**:
   - Match pattern: `returnType methodName(params) qualifiers;`
   - Qualifiers: `const`, `virtual`, `override`, `= 0`
   - Constructor: method name matches class name, no return type
   - Destructor: `~ClassName()`
   - Store as `CMethod` objects on the parsed `CStruct`.

4. **Parse inheritance**:
   - After class name, check for `: public ClassName`
   - Store as `baseClass` on the result.

5. **Validation**:
   - Base class must be a known struct/class name.
   - Constructor name must match class name.
   - Pure virtual methods (`= 0`) make the class abstract — cannot instantiate directly.
   - Duplicate method names are allowed (overloading) but not supported in interpreter; warn.

**Estimated change**: ~200 lines.

#### 4.2.2 — Visualizer Mode Parser (`engine/interpreter/parser.ts`)

**File**: `src/engine/interpreter/parser.ts`

Add new AST node types:

```typescript
// New AST nodes
interface ClassDefNode {
  kind: "ClassDef";
  name: string;
  baseClass?: string;
  sections: ClassSection[];   // grouped by access level
  line: number;
}

interface ClassSection {
  access: "public" | "private" | "protected";
  members: (FieldDeclNode | MethodDefNode)[];
}

interface MethodDefNode {
  kind: "MethodDef";
  className: string;
  name: string;
  returnType: CType;
  params: ParamNode[];
  body: BlockNode;
  isVirtual: boolean;
  isConst: boolean;
  isConstructor: boolean;
  isDestructor: boolean;
  initializerList?: { field: string; value: ExprNode }[];  // for constructors
  line: number;
}

// Extend existing
interface MemberExprNode {
  // ... existing
  isMethodCall?: boolean;    // NEW: obj.method() vs obj.field
}
```

**Parser changes**:

1. **`parseTopLevel()`**: Add branch for `class` keyword → `parseClassDef()`.
2. **`parseClassDef()`**: New function:
   - Parse `class Name`, optional `: public Base`, then `{`.
   - Loop: parse access specifiers, field declarations, method declarations/definitions.
   - Handle `ClassName(params) : init_list { body }` for constructors.
   - Handle `~ClassName() { body }` for destructors.
   - Handle `virtual returnType methodName(params) { body }`.
3. **`prescanStructNames()`**: Also scan for `class` names.
4. **`parseType()`**: Recognize `bool`, handle reference types (`int&`).
5. **`parsePostfixExpr()`**: After `.` or `->`, check if next is a method call (identifier followed by `(`).

**Method definition outside class** (optional but common):

```cpp
void Node::getData() { return data; }
```

Parse `Type ClassName::MethodName(params) { body }` by detecting `::` after an identifier.

**Estimated change**: ~350 lines.

---

### Phase 3: Interpreter — Object Lifecycle & Method Dispatch

**Goal**: Execute C++ class features — construction, method calls, virtual dispatch, destruction.

#### 4.3.1 — Class Registry

**File**: `src/engine/interpreter/interpreter.ts`

Add a class registry alongside the existing struct registry:

```typescript
interface ClassInfo {
  name: string;
  baseClass?: string;
  fields: { name: string; type: CType; access: string; defaultValue?: any }[];
  methods: Map<string, MethodInfo>;
  vtable: Map<string, string>;    // methodName → resolvedClassName
  constructors: MethodDefNode[];
  destructor?: MethodDefNode;
  hasVirtualMethods: boolean;
}

interface MethodInfo {
  node: MethodDefNode;
  access: string;
  isVirtual: boolean;
  className: string;       // defining class (for vtable resolution)
}
```

During the registration phase (before `main()` runs):
1. Register each `ClassDefNode` in a `classRegistry: Map<string, ClassInfo>`.
2. For inherited classes, copy base class fields and methods, then override with derived versions.
3. Build the vtable: for each virtual method, resolve to the most-derived implementation.

**Estimated change**: ~100 lines.

#### 4.3.2 — Memory Model Extensions

**File**: `src/engine/interpreter/memory.ts`

**`new` operator**:

```typescript
// new ClassName(args)
function allocateObject(className: string, args: RuntimeValue[]): RuntimeValue {
  const classInfo = classRegistry.get(className);
  const addr = this.heapAlloc(classInfo.totalSize);

  // 1. If has virtual methods, store vtable pointer at offset 0
  if (classInfo.hasVirtualMethods) {
    this.heapStore(addr, VTABLE_MAGIC + classInfo.name);
  }

  // 2. Zero-initialize all fields (base + derived)
  for (const field of classInfo.allFields) {
    this.heapStoreField(addr, field.name, defaultValue(field.type));
  }

  // 3. Call constructor if exists
  if (classInfo.constructors.length > 0) {
    this.callConstructor(addr, classInfo, args);
  }

  return { value: addr, type: { base: className, pointerLevel: 1, isStruct: true, isClass: true } };
}
```

**`delete` operator**:

```typescript
// delete ptr
function deallocateObject(ptr: RuntimeValue): void {
  const addr = ptr.value;
  const classInfo = this.getClassInfoFromHeap(addr);

  // 1. Call destructor if exists (walk up inheritance chain)
  if (classInfo.destructor) {
    this.callDestructor(addr, classInfo);
  }

  // 2. Free the memory
  this.heapFree(addr);
}
```

**Reference support**: A reference is stored as a pointer internally but auto-dereferences on read/write. Add a `isReference` flag to scope variables so the interpreter knows to follow the pointer transparently.

**Estimated change**: ~120 lines.

#### 4.3.3 — Method Invocation

**File**: `src/engine/interpreter/interpreter.ts`

When evaluating `obj.method(args)` or `ptr->method(args)`:

```
1. Resolve the object address (obj or *ptr).
2. Look up the method name in the class's method table.
3. If the method is virtual:
   a. Read the vtable pointer from the object (first field).
   b. Resolve the actual method to call via the vtable.
4. Push a new scope frame with:
   - `this` bound to the object address.
   - Parameters bound to argument values.
5. Execute the method body.
6. Pop the scope frame and return the result.
```

**Constructor execution**:
1. Process initializer list first (`: field1(val1), field2(val2)`).
2. Then execute constructor body.
3. Base class constructor is called first if there's a base class.

**Destructor execution**:
1. Execute derived destructor body.
2. Then call base class destructor (reverse order of construction).

**`this` pointer**: In method scope, `this` is an implicit local variable of type `ClassName*` pointing to the object address. Member access (`data` inside a method) is sugar for `this->data`.

**Estimated change**: ~200 lines.

#### 4.3.4 — Built-in Functions & Types

**File**: `src/engine/interpreter/builtins.ts`

**New built-in operators**:

| Operator/Function | Behavior |
|---|---|
| `new ClassName(args)` | Allocate + construct |
| `delete ptr` | Destruct + free |
| `cout << expr` | Append to console output |
| `cin >> var` | Read from stdin |
| `endl` | Newline constant |

**Simplified `std::string`** (built-in, not user-defined):

| Method | Behavior |
|---|---|
| `string()` / `string("text")` | Constructor |
| `.length()` / `.size()` | Return length |
| `.c_str()` | Return internal char* |
| `.substr(pos, len)` | Substring |
| `+` operator | Concatenation (special-cased) |

**Simplified `std::vector<T>`** (built-in for `int`, `float`, `double`, `char`):

| Method | Behavior |
|---|---|
| `vector<int>()` | Constructor |
| `.push_back(val)` | Append element |
| `.pop_back()` | Remove last |
| `.size()` | Return count |
| `.at(i)` / `[i]` | Element access |
| `.empty()` | Check if empty |
| `.clear()` | Remove all |

These are implemented as special-cased class names in the interpreter, not through the generic class system.

**Estimated change**: ~150 lines.

---

### Phase 4: Visualization Updates

**Goal**: Show C++ objects, inheritance, vtables, and method calls in the UI.

#### 4.4.1 — Heap Mapper

**File**: `src/engine/heapMapper.ts`

When mapping a C++ object to a `StructInstance`:
- Use the class name as `structName`.
- If the object has a base class, include base class fields in the field list, visually separated (e.g., a divider row labeled "— Base: ClassName —").
- If the object has a vtable, add a synthetic `__vptr` field at the top showing the dynamic type.
- Mark fields by access level so the StructNode can render them differently.

**Estimated change**: ~60 lines.

#### 4.4.2 — StructNode Rendering

**File**: `src/components/StructNode.tsx`

- Show access level icons/badges next to fields (a small lock for private, shield for protected, nothing for public).
- If the struct has methods, show a collapsed "Methods" section at the bottom of the card listing method signatures.
- Show `[class]` tag in the header alongside the struct name for C++ classes.
- Inherited fields get a subtle background tint to distinguish them from the class's own fields.

**Estimated change**: ~80 lines.

#### 4.4.3 — Stack Frame Panel

**File**: `src/components/visualizer/StackFramePanel.tsx`

- When inside a method call, show the call stack entry as `ClassName::methodName` instead of just a function name.
- Show `this` pointer in the variables table with its address value.
- Show `[constructor]` / `[destructor]` badges for lifecycle methods.

**Estimated change**: ~30 lines.

#### 4.4.4 — Heap Canvas — Inheritance Edges

**File**: `src/components/visualizer/HeapCanvas.tsx`

- When a class has a base class, and both are instantiated on the heap, draw a dashed "inherits" edge from derived to base definition (distinct from pointer edges).
- This is a _type-level_ relationship, not an instance-level one, so it could be an optional overlay toggle.

**Estimated change**: ~40 lines.

---

### Phase 5: Free Mode Support

**Goal**: Let users define C++ classes in the sidebar editor and instantiate them on the canvas.

#### 4.5.1 — StructEditor Updates

**File**: `src/components/StructEditor.tsx`

- Add a toggle at the top: **struct** / **class** (controls `isClass` flag and default access level).
- When "class" is selected:
  - Show an **Inheritance** input field below the name: "Extends: ___" (dropdown of known class/struct names).
  - Show access specifier labels (`public:`, `private:`, `protected:`) in the code editor, auto-inserted.
  - Allow method declarations in the code (parsed and stored but not executable in free mode).
- The parser (`structParser.ts`) handles the actual parsing; the editor just needs to allow the syntax.
- Validation messages should guide users on C++ syntax ("Use `class` keyword for classes", "Constructor name must match class name", etc.).

**Estimated change**: ~80 lines.

#### 4.5.2 — Sidebar Templates

**File**: `src/components/Sidebar.tsx`

Add new C++ template category alongside existing C templates:

| Template | Description | Structures |
|---|---|---|
| **C++ Linked List** | Class-based singly linked list | `class Node { int data; Node* next; Node(int d); }` |
| **C++ Binary Tree** | Class with virtual methods | `class TreeNode { int val; TreeNode* left; TreeNode* right; virtual void print(); }` |
| **C++ Inheritance** | Base + Derived class | `class Shape { virtual double area(); }` + `class Circle : public Shape { double radius; double area() override; }` |
| **C++ Stack** | Template-style stack | `class Stack { int* data; int top; int capacity; void push(int); int pop(); }` |
| **C++ Graph** | Adjacency list with classes | `class Vertex { int id; Vertex* neighbors[4]; }` + `class Graph { Vertex* vertices; int count; }` |

Each template instantiates connected objects on the canvas with sample data, following the same pattern as existing C templates.

**Estimated change**: ~200 lines.

#### 4.5.3 — Canvas Store

**File**: `src/store/canvasStore.ts`

- `addDefinition()` and `updateDefinition()` already work with `CStruct`. Since we're extending `CStruct` with optional C++ fields (`isClass`, `baseClass`, `methods`), no interface change is needed.
- Add validation: when a class that is used as a base class is deleted, warn the user that derived classes will lose their base.
- Workspace serialization (JSON export/import) already handles arbitrary `CStruct` fields, so new fields serialize automatically.

**Estimated change**: ~20 lines.

---

### Phase 6: Visualizer Mode Sample Code

**Goal**: Provide C++ example code in the visualizer editor.

#### 4.6.1 — Sample Code Update

**File**: `src/store/visualizerStore.ts`

Add a C++ sample alongside the existing C sample. The mode could be auto-detected from the code content (presence of `class`, `cout`, `new`, etc.) or selected via a toggle.

**C++ sample**:

```cpp
#include <stdio.h>

class Node {
public:
    int data;
    Node* next;

    Node(int d) : data(d), next(nullptr) {}
};

int main() {
    Node* head = new Node(10);
    head->next = new Node(20);
    head->next->next = new Node(30);

    Node* curr = head;
    while (curr != nullptr) {
        printf("%d ", curr->data);
        curr = curr->next;
    }
    printf("\n");

    // Cleanup
    while (head != nullptr) {
        Node* temp = head;
        head = head->next;
        delete temp;
    }
    return 0;
}
```

**Estimated change**: ~40 lines.

#### 4.6.2 — Language Detection

**File**: `src/engine/traceRunner.ts`

The trace runner doesn't need to change much — the lexer/parser will handle C++ syntax transparently. However, add a language hint:

```typescript
function detectLanguage(code: string): "c" | "cpp" {
  if (/\bclass\b/.test(code) || /\bnew\b/.test(code) || /\bcout\b/.test(code) || /\bnullptr\b/.test(code)) {
    return "cpp";
  }
  return "c";
}
```

This hint can be used to:
- Show "C++" badge in the editor header.
- Enable/disable C++-specific parser branches for performance.

**Estimated change**: ~15 lines.

---

## 5. Files Modified — Complete List

| File | Phase | Change Type | Estimated Lines |
|---|---|---|---|
| `src/engine/interpreter/lexer.ts` | 1 | Add keywords | +10 |
| `src/engine/interpreter/ast.ts` | 1 | Extend CType, add nodes | +80 |
| `src/types/index.ts` | 1 | Add CMethod, extend CStruct/CField | +50 |
| `src/types/visualizer.ts` | 1 | Extend HeapObject, VariableSnapshot | +15 |
| `src/parser/structParser.ts` | 2 | Class parsing, methods, inheritance | +200 |
| `src/engine/interpreter/parser.ts` | 2 | ClassDef, MethodDef, `::` scope | +350 |
| `src/engine/interpreter/interpreter.ts` | 3 | Class registry, method dispatch, vtable | +300 |
| `src/engine/interpreter/memory.ts` | 3 | new/delete, references, vtable storage | +120 |
| `src/engine/interpreter/builtins.ts` | 3 | cout/cin, string, vector built-ins | +150 |
| `src/engine/heapMapper.ts` | 4 | Inheritance fields, vtable display | +60 |
| `src/components/StructNode.tsx` | 4 | Access badges, method section | +80 |
| `src/components/visualizer/StackFramePanel.tsx` | 4 | Class::method display, `this` | +30 |
| `src/components/visualizer/HeapCanvas.tsx` | 4 | Inheritance edges (optional) | +40 |
| `src/components/StructEditor.tsx` | 5 | Class/struct toggle, inheritance input | +80 |
| `src/components/Sidebar.tsx` | 5 | C++ templates | +200 |
| `src/store/canvasStore.ts` | 5 | Base class deletion warning | +20 |
| `src/store/visualizerStore.ts` | 6 | C++ sample code | +40 |
| `src/engine/traceRunner.ts` | 6 | Language detection | +15 |
| **Total** | | | **~1,840** |

---

## 6. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Parser complexity explosion with full C++ grammar | High | Restrict to the subset listed in scope. Reject unsupported syntax with clear error messages. |
| Virtual dispatch correctness | Medium | Build comprehensive test cases for single inheritance chains of depth 3+. Compare output against g++ compiled results. |
| Constructor/destructor ordering bugs | Medium | Follow C++ standard order strictly: base constructor → derived constructor → derived destructor → base destructor. Unit test each ordering. |
| Performance degradation from vtable lookups | Low | Vtable is a simple Map lookup, not a real pointer chase. Performance impact is negligible for educational-sized programs. |
| Breaking existing C code | High | All C++ features are additive. Run the full existing test suite after each phase. The parser only enters C++ branches when it sees `class`, `new`, `delete`, etc. |
| `std::string` / `std::vector` scope creep | Medium | Implement only the methods listed in this plan. Reject unknown methods with "not supported" errors rather than silently failing. |

---

## 7. Testing Strategy

### Unit Tests (per phase)

**Phase 1 — Lexer/Types**:
- Tokenize C++ keywords correctly.
- `CType` with `isClass`, `isReference`, `isConst` flags serializes/deserializes.

**Phase 2 — Parser**:
- Parse basic class with fields only.
- Parse class with constructor, destructor, methods.
- Parse single inheritance.
- Parse access specifiers switching mid-class.
- Parse method definitions outside class (`ClassName::method`).
- Reject unsupported syntax (multiple inheritance, templates) with errors.

**Phase 3 — Interpreter**:
- `new`/`delete` allocate and free correctly.
- Constructor initializer list sets fields.
- Method call with `this` reads/writes object fields.
- Virtual method dispatch calls derived method when base pointer is used.
- Destructor chain runs in correct order (derived → base).
- `nullptr` comparisons work.
- `cout << "hello" << 42 << endl` produces correct console output.
- Reference variables alias their target.

**Phase 4 — Visualization**:
- C++ object on heap canvas shows class name and fields.
- Inherited fields appear with visual distinction.
- Stack frame shows `ClassName::methodName` for method calls.
- `this` appears in variable table during method execution.

**Phase 5 — Free Mode**:
- Class definitions parse and create struct definitions with `isClass: true`.
- Inheritance field populates `baseClass`.
- Templates instantiate correctly on canvas.
- Workspace save/load round-trips C++ class definitions.

### Integration Tests

- **Linked list with classes**: Define `class Node`, create 3-node list with `new`, traverse, `delete` all. Verify heap canvas shows chain, then shows freed nodes.
- **Inheritance polymorphism**: Base class `Shape` with virtual `area()`, derived `Circle` and `Rectangle`. Create instances via base pointer, call `area()`, verify correct dispatch in trace.
- **Constructor chain**: `class A` base, `class B : public A`. Create `B`, verify A constructor runs first, then B. Delete, verify B destructor runs first, then A.
- **Mixed C/C++**: Program uses both `malloc`/`free` (C-style) and `new`/`delete` (C++-style). Verify both work and visualize correctly.

---

## 8. Implementation Order & Dependencies

```
Phase 1: Lexer & Types ─────────────────────────┐
                                                  │
Phase 2: Parsers (struct + interpreter) ─────────┤
         ↓ depends on Phase 1                     │
                                                  │
Phase 3: Interpreter runtime ────────────────────┤
         ↓ depends on Phase 2                     │
                                                  │
Phase 4: Visualization ──────────────────────────┤
         ↓ depends on Phase 3                     │
                                                  │
Phase 5: Free Mode UI ──────────────────────────┘
         ↓ depends on Phase 2 (parser only)
         (can be done in parallel with Phase 3-4)

Phase 6: Sample code & polish
         ↓ depends on Phase 3
```

**Parallelizable**: Phase 5 (Free Mode) only depends on Phase 2 (parser). It can be developed in parallel with Phases 3-4 since free mode doesn't execute code.

---

## 9. Future Extensions (Post v2.1.0)

These are explicitly deferred but could be added in later versions:

- **Operator overloading**: Parse and execute `operator+`, `operator<<`, etc.
- **Exception handling**: `try`/`catch`/`throw` with stack unwinding visualization.
- **Smart pointers**: `std::unique_ptr<T>` and `std::shared_ptr<T>` as built-in types with reference count visualization.
- **`std::map`**: Hash map visualization with bucket layout.
- **Multiple inheritance**: Diamond problem visualization (educational).
- **Template instantiation**: `template<typename T> class Node<T>` with user-specified type parameter.
- **Abstract class enforcement**: Prevent instantiation of classes with pure virtual methods.
