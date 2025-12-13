import type { CStruct } from "../types";

export const exampleStructs: CStruct[] = [
  {
    name: "Person",
    fields: [
      { name: "age", type: "int", isPointer: false, isArray: false },
      { name: "name", type: "char", isPointer: true, isArray: false },
      { name: "next", type: "Person", isPointer: true, isArray: false },
    ],
  },
  {
    name: "Node",
    fields: [
      { name: "data", type: "int", isPointer: false, isArray: false },
      { name: "next", type: "Node", isPointer: true, isArray: false },
    ],
  },
  {
    name: "TreeNode",
    fields: [
      { name: "value", type: "int", isPointer: false, isArray: false },
      { name: "left", type: "TreeNode", isPointer: true, isArray: false },
      { name: "right", type: "TreeNode", isPointer: true, isArray: false },
    ],
  },
  {
    name: "Student",
    fields: [
      { name: "id", type: "int", isPointer: false, isArray: false },
      { name: "name", type: "char", isPointer: true, isArray: false },
      {
        name: "grades",
        type: "float",
        isPointer: false,
        isArray: true,
        arraySize: 5,
      },
      { name: "mentor", type: "Student", isPointer: true, isArray: false },
    ],
  },
];

export const structCodeExamples = {
  linkedList: `struct Node {
  int data;
  struct Node* next;
};`,

  binaryTree: `struct TreeNode {
  int value;
  struct TreeNode* left;
  struct TreeNode* right;
};`,

  graph: `struct GraphNode {
  int id;
  char* label;
  struct GraphNode* neighbors;
};`,

  student: `struct Student {
  int id;
  char* name;
  float grades[5];
  struct Student* mentor;
};`,
};
