import type { CStruct, StructInstance, PointerInstance, PointerConnection } from "./index";

export interface VariableSnapshot {
  name: string;
  type: string;          // "int", "struct Node*", "char[20]"
  value: string;         // human-readable
  isPointer: boolean;
  pointerLevel: number;
  pointsTo?: number;     // simulated heap address
}

export interface StackFrame {
  functionName: string;
  line: number;
  variables: VariableSnapshot[];
}

export interface HeapObject {
  address: number;
  typeName: string;
  isStruct: boolean;
  fields: Record<string, {
    value: string;
    type: string;
    isPointer: boolean;
    pointerLevel: number;
    pointsTo?: number;
  }>;
  freed: boolean;
}

export interface HeapState {
  objects: HeapObject[];
  structDefinitions: CStruct[];
  structInstances: StructInstance[];
  pointerInstances: PointerInstance[];
  connections: PointerConnection[];
}

export interface ExecutionStep {
  index: number;
  line: number;           // 1-based source line
  column: number;
  statement: string;
  consoleOutput: string;  // cumulative stdout
  callStack: StackFrame[];
  heapObjects: HeapObject[];
  stackVariables: VariableSnapshot[];
}
