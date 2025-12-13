// Core type definitions for the C struct visualizer

export type CPrimitiveType =
  | "int"
  | "char"
  | "float"
  | "double"
  | "long"
  | "short"
  | "void";

export interface CField {
  name: string;
  type: string;
  isPointer: boolean;
  isArray: boolean;
  arraySize?: number;
  pointerLevel?: number; // Number of * (e.g., 1 for *, 2 for **, 3 for ***)
  isFunctionPointer?: boolean; // True if this is a function pointer
}

export interface CStruct {
  name: string;
  typedef?: string;
  fields: CField[];
  color?: string; // Pastel color assigned to this struct type
}

export interface StructInstance {
  id: string;
  structName: string;
  instanceName: string;
  position: { x: number; y: number };
  fieldValues: Record<string, unknown>;
}

export interface PointerConnection {
  id: string;
  sourceInstanceId: string;
  sourceFieldName: string;
  targetInstanceId: string;
}
