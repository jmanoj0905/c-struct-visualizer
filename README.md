# C Struct Visualizer

An interactive, beginner-friendly visual tool for learning C structs, pointers, and data structures. Built with React, TypeScript, and React Flow, featuring a modern neobrutalist design aesthetic.

![Version](https://img.shields.io/badge/version-1.2.0-blue)
![License](https://img.shields.io/badge/license-GPL--3.0-green)
![React](https://img.shields.io/badge/React-19-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)

## Features

### Core Functionality
- **Parse C Struct Definitions**: Write real C struct code with instant visualization
- **Interactive Canvas**: Draggable struct instances with snap-to-grid support
- **Visual Pointers**: Connect pointers between structs with intuitive drag-and-drop
- **Real-time Type Validation**: IDE-like syntax checking with line-by-line error reporting
- **Multiple Instances**: Create unlimited instances with unique colors per struct type
- **Smart Auto-Layout**: Intelligent graph arrangement for cyclic and acyclic structures
- **Built-in Templates**: Quick-start with linked lists, binary trees, and graphs
- **Custom Structs**: Define complex structs with arrays, nested types, and function pointers

### Visual Features
- **Path Highlighting**: Visualize pointer chains and detect circular references
- **40 Unique Colors**: Deterministic pastel colors ensure each struct type is distinct
- **Neobrutalism Design**: Bold borders, shadows, and vibrant UI following neobrutalism.dev
- **Smooth Animations**: Polished transitions and interactive feedback

### Productivity Tools
- **History System**: Full undo/redo support with keyboard shortcuts
- **Import/Export**: Save and load your workspace as JSON
- **PNG Export**: Export diagrams as high-quality images
- **Right-click Menus**: Context-aware actions for quick operations
- **Keyboard Shortcuts**: Efficient workflow with standard hotkeys
- **Duplicate Nodes**: Ctrl+D to duplicate with connections preserved

## Perfect For

- Students learning C programming and data structures
- Understanding pointers and memory layouts
- Visualizing linked lists, trees, graphs, and complex structures
- Teaching computer science concepts
- Debugging pointer relationships
- Creating educational materials and diagrams

## Getting Started

### Prerequisites

- Node.js 16 or higher
- npm or yarn package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/c-struct-visualizer.git
cd c-struct-visualizer

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

Then open http://localhost:5173/ in your browser.

## How to Use

### Creating Structs

1. **Load a Template**: Click "TEMPLATES" in the sidebar for pre-built structures
2. **Define Custom Struct**: Click "+ New Struct" button
3. **Write C Code**: Use standard C syntax with real-time validation
4. **Add Fields**: Supports all C types, pointers, arrays, and function pointers

**Important C Syntax Rules**:
- Use `struct Name*` for pointer fields (standard C)
- Cannot use typedef names inside struct definitions
- Real-time error checking shows issues as you type

### Working with Instances

1. **Add Instances**: 
   - Drag from sidebar onto canvas
   - Double-click canvas for quick-add menu
2. **Move Nodes**: Click and drag to reposition
3. **Edit Values**: Click fields to enter data
4. **Edit Names**: Click edit icon next to instance name
5. **Delete**: Right-click → Delete Node

### Creating Connections

1. **Pointer Handles**: Black circles on right side (source)
2. **Target Handles**: Black circle on left side (target)
3. **Create Connection**: Drag from pointer to target
4. **Quick Connect**: Drag to empty space to create new connected instance
5. **Delete Connection**: Right-click the arrow → Delete
6. **Type Safety**: Automatic validation ensures type compatibility

### Advanced Features

- **Auto-Layout**: Click grid icon (bottom-right) to organize diagram
  - Handles cyclic structures (circular lists, bidirectional links)
  - Compact spacing for readability
  - Deterministic positioning (same layout every time)
- **Path Highlighting**: Click any node to trace pointer chains
- **Fit to Window**: Click maximize icon for optimal zoom (90% max)
- **Undo/Redo**: Ctrl+Z / Ctrl+Shift+Z or toolbar buttons
- **Selection Mode**: Hand icon for pan, mouse icon for multi-select
- **Bulk Operations**: Select multiple nodes for group operations

### Keyboard Shortcuts

- `Ctrl+Z` - Undo
- `Ctrl+Shift+Z` or `Ctrl+Y` - Redo
- `Ctrl+D` - Duplicate selected nodes with connections
- `Ctrl+A` - Select all
- `Ctrl+C` - Copy selected nodes
- `Ctrl+V` - Paste nodes
- `Delete` - Delete selected nodes/connections
- `Escape` - Clear selection and highlights
- `Shift` - Toggle selection mode

## Example Structs

### Singly Linked List
```c
typedef struct Node {
  int data;
  struct Node* next;  // Note: use 'struct Node*', not 'Node*'
} Node;
```

### Binary Tree
```c
typedef struct TreeNode {
  int data;
  struct TreeNode* left;
  struct TreeNode* right;
} TreeNode;
```

### Circular Doubly Linked List
```c
typedef struct DNode {
  int data;
  struct DNode* prev;
  struct DNode* next;
} DNode;
```

### Graph with Neighbors
```c
typedef struct GraphNode {
  int id;
  struct GraphNode* neighbors[4];
} GraphNode;
```

### Complex Structure
```c
typedef struct Person {
  char name[50];
  int age;
  struct Person* spouse;
  struct Person* children[10];
  void (*callback)(void);
} Person;
```

## Tech Stack

- **React 19** - Modern UI with latest features
- **TypeScript 5.9** - Static type safety
- **Vite 5** - Lightning-fast build tool
- **React Flow 12** - Node-based canvas
- **Zustand 5** - Lightweight state management
- **Tailwind CSS 3** - Utility-first styling
- **ELK.js** - Automatic graph layout
- **Radix UI** - Accessible component primitives
- **Lucide React** - Beautiful icon library
- **html-to-image** - Canvas export

## Project Structure

```
src/
├── components/
│   ├── ui/                  # Neobrutalism UI components
│   │   ├── button.tsx       # Button with variants
│   │   ├── input.tsx        # Styled input
│   │   ├── card.tsx         # Card with sub-components
│   │   ├── alert.tsx        # Alert component
│   │   └── checkbox.tsx     # Radix checkbox
│   ├── StructNode.tsx       # Struct instance renderer
│   ├── StructEditor.tsx     # Modal with real-time validation
│   ├── Sidebar.tsx          # Left sidebar (animated)
│   ├── Settings.tsx         # Settings modal
│   └── AlertContainer.tsx   # Notification system
├── parser/
│   └── structParser.ts      # C parser with validation
├── store/
│   └── canvasStore.ts       # State + history management
├── utils/
│   ├── colors.ts            # 40 pastel colors
│   ├── circularLayouts.ts   # Cycle detection & layout
│   └── graphAnalysis.ts     # SCC analysis
├── lib/
│   └── utils.ts             # cn() helper
└── App.tsx                  # Main component
```

## Design System

### Neobrutalism Theme
- **Bold Borders**: 2-4px black borders
- **Box Shadows**: 4px 4px 0px rgba(0,0,0,1)
- **Sharp Corners**: Minimal rounding (rounded-base)
- **High Contrast**: Vibrant colors with clear hierarchy
- **Typography**: Font weights 500-700 for emphasis

### Color System
- 40 unique pastel colors for struct types
- Deterministic assignment (alphabetically sorted)
- Consistent across all instances of same type
- Themed alerts and buttons

## Features in Detail

### C Syntax Parser
- **Real-time Validation**: Line-by-line error reporting
- **Type System**: Full typedef support with proper scoping
- **Pointer Support**: Multi-level pointers (`int**`, `char***`)
- **Array Support**: Fixed-size and pointer arrays
- **Function Pointers**: `void (*callback)(void)`
- **Struct Pointers**: Requires `struct Name*` syntax (C standard)

### Auto-Layout Algorithm
- **Cycle Detection**: Identifies SCCs (Strongly Connected Components)
- **Pattern Recognition**: Self-loops, bidirectional, circular lists, general cycles
- **Compact Spacing**: Optimized for readability
  - Node spacing: 80px
  - Layer spacing: 150px
  - Padding: 50px
- **Deterministic**: Same graph structure = same layout every time

### State Management
- **History Stack**: 50-state undo/redo buffer
- **Persistent Settings**: localStorage for user preferences
- **Workspace Export**: Full serialization to JSON
- **Auto-save**: Canvas state preserved across sessions

## Contributing

Contributions are welcome! Please see our contributing guidelines:

### How to Contribute

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit (`git commit -m 'Add amazing feature'`)
5. Push (`git push origin feature/amazing-feature`)
6. Open Pull Request

### Guidelines

- Follow existing code style
- Write clear commit messages
- Add tests for new features
- Update documentation
- Ensure builds pass

## Reporting Issues

When reporting bugs, include:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Browser and OS info

## License

This project is licensed under the **GNU General Public License v3.0**.

See the [LICENSE](LICENSE) file for details.

---

**Version 1.2.0** - Complete neobrutalism UI redesign with improved auto-layout and validation

Made with ❤️ by [Manoj](https://github.com/jmanoj0905)
