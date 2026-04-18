import type { CStruct, StructInstance, PointerInstance, PointerConnection } from "./index";

export interface VariableSnapshot {
  name: string;
  type: string;          // "int", "struct Node*", "char[20]"
  value: string;         // human-readable
  isPointer: boolean;
  pointerLevel: number;
  pointsTo?: number;     // simulated heap address
  isReference?: boolean;
  isConst?: boolean;
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
  className?: string;
  hasVtable?: boolean;
  baseClassFields?: string[];
}

export interface StackPointerMetadata {
  variableName: string;
  frameIndex: number;      // 0 = active, higher = older
  frameName: string;       // e.g., "main()"
  targetAddress: number;   // heap address
  color: string;           // from getPointerColor()
}

export interface HeapState {
  objects: HeapObject[];
  structDefinitions: CStruct[];
  structInstances: StructInstance[];
  pointerInstances: PointerInstance[];
  connections: PointerConnection[];
  stackPointers: StackPointerMetadata[];  // Stack-to-heap pointer arrows
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
