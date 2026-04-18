// Core type definitions for the C struct visualizer

export type WorkspaceMode = "free" | "visualizer";
export type WorkspaceLanguage = "c" | "cpp";

export interface WorkspaceTab {
  id: string;
  name: string;
  createdAt: number;
  mode: WorkspaceMode;
  language: WorkspaceLanguage;
}

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
  accessLevel?: "public" | "private" | "protected";
  isStatic?: boolean;
}

export interface CMethod {
  name: string;
  returnType: string;
  parameters: { name: string; type: string }[];
  accessLevel: "public" | "private" | "protected";
  isVirtual: boolean;
  isConst: boolean;
  isStatic: boolean;
  isPureVirtual: boolean;
  isConstructor: boolean;
  isDestructor: boolean;
}

export interface CStruct {
  name: string;
  typedef?: string;
  fields: CField[];
  color?: string; // Pastel color assigned to this struct type
  isClass?: boolean;
  baseClass?: string;
  methods?: CMethod[];
  accessDefault?: "public" | "private";
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
  targetFieldName?: string | null;
}

export interface PointerVariable {
  id: string;
  name: string;
  type: string;
  pointerLevel: number;
  rawDeclaration: string;
  color: string;
}

export interface PointerInstance {
  id: string;
  pointerVariableId: string;
  name: string;
  type: string;
  pointerLevel: number;
  position: { x: number; y: number };
  targetInstanceId: string | null;
  targetFieldName: string | null;
  color: string;
}
