# C Struct Visualizer

An interactive, beginner-friendly visual tool for learning C structs, pointers, and data structures. Built with React, TypeScript, and React Flow, featuring a neobrutalist design aesthetic.

## Features

- **Parse C Struct Definitions**: Write C struct code and visualize it instantly
- **Interactive Canvas**: Draggable struct instances with snap-to-grid support
- **Visual Pointers**: Connect pointers between structs with drag-and-drop connections
- **Type Checking**: Robust type validation ensures pointers match target types
- **Multiple Instances**: Create unlimited instances of any struct
- **Auto-Layout**: Intelligent graph layout using ELK.js algorithm
- **Built-in Templates**: Quick-start with linked lists, binary trees, and graphs
- **Custom Structs**: Define your own complex structs with arrays, function pointers, and nested types
- **Path Highlighting**: Click any node to visualize pointer chains and detect circular references
- **History System**: Full undo/redo support for all operations
- **Import/Export**: Save and load your workspace as JSON
- **PNG Export**: Export your diagrams as high-quality images

## Perfect For

- Students learning C programming and data structures
- Understanding pointers and pointer arithmetic
- Visualizing linked lists, trees, graphs, and complex data structures
- Teaching computer science concepts
- Debugging pointer relationships and memory layouts
- Creating educational materials and diagrams

## Tech Stack

- **React 18** - Modern UI framework with hooks
- **TypeScript** - Static type checking and enhanced IDE support
- **Vite** - Next-generation frontend build tool
- **React Flow** - Powerful node-based canvas library
- **Zustand** - Lightweight state management
- **Tailwind CSS** - Utility-first CSS framework
- **ELK.js** - Automatic graph layout engine
- **Lucide React** - Beautiful icon library
- **html-to-image** - Canvas to image export

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

# Preview production build
npm run preview
```

Then open http://localhost:5173/ in your browser.

## How to Use

### Creating Structs

1. **Load a Template**: Click "TEMPLATES" in the sidebar to load pre-built data structures
2. **Define Custom Struct**: Click "New Struct" to create your own struct definition
3. **Add Fields**: Define field names, types, and modifiers (pointer, array, function pointer)

### Working with Instances

1. **Add Instances**: Drag a struct from the sidebar onto the canvas, or double-click the canvas
2. **Move Blocks**: Click and drag any struct instance to reposition it
3. **Edit Values**: Click input fields to enter values for primitive fields
4. **Edit Instance Names**: Click the edit icon next to the instance name

### Creating Connections

1. **Pointer Handles**: Black squares on the right side of pointer fields
2. **Target Handles**: Black square on the left side of each instance
3. **Create Connection**: Drag from a pointer handle to a target handle
4. **Quick Connect**: Drag a pointer to empty space to create and connect a new instance
5. **Type Safety**: Connections are validated - pointer types must match target struct types

### Advanced Features

- **Auto-Layout**: Click the sparkle button (bottom-right) to organize your diagram
- **Path Highlighting**: Click any node to highlight all connected nodes in the pointer chain
- **Undo/Redo**: Use Ctrl+Z / Ctrl+Shift+Z or the button panel
- **Selection Mode**: Hold Shift or click the mode toggle to select multiple nodes
- **Bulk Operations**: Select multiple nodes and delete, copy, or paste them together
- **Context Menu**: Right-click nodes or canvas for quick actions
- **Keyboard Shortcuts**:
  - `Ctrl+Z` - Undo
  - `Ctrl+Shift+Z` or `Ctrl+Y` - Redo
  - `Ctrl+A` - Select all
  - `Ctrl+C` - Copy selected nodes
  - `Ctrl+V` - Paste nodes
  - `Delete` - Delete selected nodes
  - `Escape` - Clear selection and highlights
  - `Shift` - Toggle selection mode

## Example Structs

### Singly Linked List
```c
struct Node {
  int data;
  struct Node* next;
};
```

### Binary Tree
```c
struct TreeNode {
  int data;
  struct TreeNode* left;
  struct TreeNode* right;
};
```

### Graph with Array of Neighbors
```c
struct GraphNode {
  int id;
  struct GraphNode* neighbors[4];
};
```

### Complex Structure
```c
struct Person {
  char name[50];
  int age;
  struct Person* spouse;
  struct Person* children[10];
  void (*callback)(void);
};
```

## Project Structure

```
src/
├── components/
│   ├── StructNode.tsx       # Individual struct instance component
│   ├── StructEditor.tsx     # Modal for defining/editing structs
│   ├── CustomEdge.tsx       # Custom pointer connection visualization
│   ├── Sidebar.tsx          # Left sidebar with struct list and templates
│   ├── Settings.tsx         # Settings modal
│   ├── ThemedAlert.tsx      # Custom themed alert component
│   └── AlertContainer.tsx   # Alert management system
├── parser/
│   └── structParser.ts      # C struct parser and type resolver
├── store/
│   └── canvasStore.ts       # Zustand state with history management
├── utils/
│   └── colors.ts            # Deterministic color generation
├── types/
│   └── index.ts             # TypeScript type definitions
└── App.tsx                  # Main application component
```

## Features in Detail

### Type System
The visualizer enforces C's type system with full typedef support:
- Pointer type matching with struct name resolution
- Typedef aliasing (e.g., `typedef struct Node ListNode`)
- Multi-level pointer support (e.g., `int**`, `char***`)
- Function pointer support
- Array support (fixed-size and pointer arrays)
- `void*` support (can point to any type)

### Visual Design
- **Neobrutalist Theme**: Bold borders, shadows, and vibrant colors
- **Deterministic Colors**: Each struct type gets a consistent color across the app
- **Themed Alerts**: Custom notification system matching the design language
- **Hover Effects**: Interactive feedback on all UI elements
- **Smooth Animations**: Transitions and animated connections

### State Management
- **History System**: Complete undo/redo stack for all operations
- **Persistent Settings**: User preferences saved to localStorage
- **Auto-save State**: Canvas state preserved across sessions
- **Import/Export**: Full workspace serialization

## Contributing

Contributions are welcome! We appreciate all forms of contribution including bug reports, feature requests, documentation improvements, and code contributions.

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add some amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Contribution Guidelines

- Follow the existing code style and conventions
- Write clear commit messages
- Add tests for new features when applicable
- Update documentation as needed
- Ensure all builds pass before submitting PR

### Reporting Bugs

When reporting bugs, please include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Browser and OS information

### Feature Requests

We welcome feature suggestions! Please:
- Check existing issues first to avoid duplicates
- Provide clear use cases
- Explain how it benefits users
- Consider implementation complexity

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

### GNU GPL v3.0

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see https://www.gnu.org/licenses/.

## Acknowledgments

- Built with React Flow for the interactive canvas
- ELK.js for automatic graph layout
- Inspired by visual learning tools for computer science education
- Neobrutalist design inspiration from the web design community

## Support

If you find this project helpful, please consider:
- Starring the repository
- Sharing it with others learning C
- Contributing improvements
- Reporting bugs and suggesting features

## Roadmap

Future enhancements under consideration:
- Memory address simulation with visual offsets
- Step-by-step execution visualization
- Code generation from visual diagrams
- C code import/parsing from files
- Collaborative editing features
- Dark mode support
- Additional export formats (SVG, PDF)
- Memory leak detection visualization
- Stack vs heap visualization
