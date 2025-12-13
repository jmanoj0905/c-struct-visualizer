# C Struct Visualizer

An interactive, beginner-friendly visual tool for learning C structs, pointers, and data structures. Built with React, TypeScript, and React Flow.

## Features

- **Parse C Struct Definitions**: Write C struct code and visualize it instantly
- **Draggable Blocks**: Each struct instance is a floating, draggable block
- **Visual Pointers**: Connect pointers between structs with drag-and-drop
- **Type Checking**: Robust type validation ensures pointers match target types
- **Multiple Instances**: Create multiple instances of the same struct
- **Built-in Examples**: Includes Person and Node structs to get started
- **Custom Structs**: Define your own structs on the fly
- **Beginner-Friendly UI**: Helpful tooltips, guides, and clear visual feedback

## Perfect For

- Students learning C programming
- Understanding pointers and pointer arithmetic
- Visualizing linked lists, trees, and graphs
- Teaching data structures concepts
- Debugging complex pointer relationships

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

Then open http://localhost:5173/ in your browser.

## How to Use

1. **Add Instances**: Select a struct type from the dropdown and click "Add Instance"
2. **Move Blocks**: Click and drag any struct block to reposition it
3. **Connect Pointers**:
   - Green circles = pointer handles (source)
   - Drag from a green circle to a purple circle (target) to create a connection
4. **Type Safety**: The app validates that pointer types match target structs
5. **Edit Values**: Click on input fields to enter values for non-pointer fields
6. **Define Custom Structs**: Click "Define Custom Struct" to add your own

## Example Structs

### Linked List Node
```c
struct Node {
  int data;
  struct Node* next;
};
```

### Person with Pointer
```c
struct Person {
  int age;
  char* name;
  struct Person* next;
};
```

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **React Flow** - Node-based canvas
- **Zustand** - State management
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

## Project Structure

```
src/
├── components/
│   ├── StructNode.tsx      # Individual struct block component
│   ├── Toolbar.tsx         # Top toolbar with controls
│   └── StructEditor.tsx    # Modal for defining custom structs
├── parser/
│   └── structParser.ts     # C struct parser
├── store/
│   └── canvasStore.ts      # Zustand state management
├── types/
│   └── index.ts            # TypeScript type definitions
└── App.tsx                 # Main app component
```

## Features in Detail

### Type Checking
The visualizer enforces C's type system:
- `int*` can only point to `int` structs
- `char*` can only point to `char` structs
- `struct Node*` can only point to `Node` instances
- `void*` can point to anything (just like in C!)

### Visual Feedback
- **Green handles**: Pointer fields (source of connection)
- **Purple handles**: Target handles (destination of connection)
- **Animated edges**: Active pointer connections
- **Color-coded types**: Easy identification of field types

### Beginner-Friendly
- Built-in help panel with quick guide
- Inline tooltips and hints
- Clear error messages for type mismatches
- Example structs to start learning immediately

## Roadmap (Future Features)

- Array visualization
- Memory address simulation
- Export diagrams as images
- Save/load projects
- Code generation from visual diagram
- Null pointer visualization
- Memory leak detection

## License

MIT

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.
