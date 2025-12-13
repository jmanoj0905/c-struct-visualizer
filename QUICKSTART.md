# Quick Start Guide

## Running the App

The app is currently running at: **http://localhost:5173/**

Open this URL in your browser to start using the C Struct Visualizer!

## First Steps

### 1. Add Your First Struct Instance
- Look at the top toolbar
- You'll see a dropdown with options: Person, Node, TreeNode, Student
- Select "Node" and click **"Add Instance"**
- A blue block will appear on the canvas!

### 2. Drag and Move
- Click anywhere on the blue block and drag it around
- The canvas is infinite - move blocks wherever you like

### 3. Create a Linked List
- Add another Node instance (click "Add Instance" again)
- You now have Node_1 and Node_2
- Look for the **green circle** on the right side of Node_1 (next to "next" field)
- **Drag from the green circle** to the **purple circle** on Node_2
- You've created a pointer connection! An animated arrow appears

### 4. Try Type Validation
- Add a Person instance
- Try connecting Node_1's "next" pointer to the Person instance
- You'll get an error! "Type mismatch: Node* cannot point to Person"
- This teaches you about type safety in C

### 5. Enter Values
- Click on the "data" field input box in any Node
- Type a number like "42"
- Click on "name" field in Person and type a name

### 6. Build a Binary Tree
- Switch dropdown to "TreeNode"
- Add 3 TreeNode instances
- Connect the first node's "left" pointer to the second node
- Connect the first node's "right" pointer to the third node
- You've visualized a binary tree!

### 7. Define Your Own Struct
- Click the purple **"Define Custom Struct"** button (bottom right)
- Try this example:
```c
struct Car {
  int year;
  char* model;
  float price;
};
```
- Click "Add Struct"
- Your custom struct now appears in the dropdown!

## Tips for Beginners

### Understanding Pointers
- **Green circles** = "This pointer can point to something"
- **Purple circles** = "Things can point to me"
- **Arrows** = Active pointer connection

### Type Safety
The app won't let you make invalid connections:
- `Person* next` can only point to Person instances
- `Node* next` can only point to Node instances
- This mirrors real C behavior!

### Learning Data Structures

**Linked List:**
```
Node_1 → Node_2 → Node_3
```

**Binary Tree:**
```
      TreeNode_1
      /        \
TreeNode_2  TreeNode_3
```

**Graph:**
```
Person_1 → Person_2
    ↓         ↓
Person_3 ← Person_4
```

## Common Use Cases

### 1. Learning Pointers
Create two Node instances and practice connecting them. This visualizes what `node1->next = &node2` means in C!

### 2. Linked List Operations
Build a complete linked list with 4-5 nodes. Practice visualizing insertions, deletions, and traversals.

### 3. Binary Tree Traversal
Create a binary tree and trace in-order, pre-order, and post-order traversals visually.

### 4. Complex Structures
Mix Person and Node to create complex data structures. Practice understanding multi-type pointer relationships.

## Keyboard Shortcuts

- **Click + Drag** on canvas background = Pan the view
- **Scroll** = Zoom in/out
- **Click** struct block = Select it
- **Drag** from green circle = Create pointer connection

## Need Help?

Look at the **blue info icon** in the top-right corner - it shows a quick guide panel!

## What's Next?

Tell me about the **2nd functionality** you want to add, and we'll build it together!
