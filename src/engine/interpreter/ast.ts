// AST node definitions for the C interpreter

export interface CType {
  base: string;        // "int", "float", "char", "double", "void", or struct/class name
  pointerLevel: number; // 0 = value, 1 = *, 2 = **, etc.
  isStruct: boolean;
  isClass?: boolean;          // true for class types
  isReference?: boolean;      // true for T& reference types
  isConst?: boolean;          // true for const-qualified
  arraySize?: number;   // if declared as array
}

export function typeToString(t: CType): string {
  let s = "";
  if (t.isConst) s += "const ";
  if (t.isStruct) s += `struct ${t.base}`;
  else s += t.base;
  s += "*".repeat(t.pointerLevel);
  if (t.isReference) s += "&";
  if (t.arraySize !== undefined) s += `[${t.arraySize}]`;
  return s;
}

export function sizeOfType(t: CType, structDefs: Map<string, StructDefNode>): number {
  if (t.pointerLevel > 0) return 8;
  if (t.isReference) return 8; // references have pointer size
  if (t.arraySize !== undefined) {
    const elem: CType = { ...t, arraySize: undefined };
    return sizeOfType(elem, structDefs) * t.arraySize;
  }
  switch (t.base) {
    case "char": return 1;
    case "short": return 2;
    case "int": return 4;
    case "float": return 4;
    case "double": return 8;
    case "long": return 8;
    case "bool": return 1;
    case "void": return 0;
    default: {
      // class types use the same size semantics as structs
      const def = structDefs.get(t.base);
      if (def) {
        let size = 0;
        for (const f of def.fields) size += sizeOfType(f.fieldType, structDefs);
        return size;
      }
      return 4;
    }
  }
}

// --- AST Nodes ---

export type ASTNode =
  | ProgramNode
  | FunctionDefNode
  | StructDefNode
  | ClassDefNode
  | VarDeclNode
  | ReturnStmtNode
  | ExprStmtNode
  | IfStmtNode
  | WhileStmtNode
  | ForStmtNode
  | DoWhileStmtNode
  | BlockNode
  | BreakStmtNode
  | ContinueStmtNode
  | SwitchStmtNode
  | MethodDefNode;

export type ExprNode =
  | NumberLitNode
  | StringLitNode
  | CharLitNode
  | IdentifierNode
  | BinaryExprNode
  | UnaryExprNode
  | AssignExprNode
  | CallExprNode
  | MemberExprNode
  | ArrowExprNode
  | DerefExprNode
  | AddrOfExprNode
  | CastExprNode
  | ArrayAccessNode
  | SizeofExprNode
  | NullLitNode
  | TernaryExprNode
  | CompoundAssignExprNode
  | PreIncDecNode
  | PostIncDecNode;

interface BaseNode { line: number; column: number; }

export interface ProgramNode extends BaseNode { kind: "Program"; body: ASTNode[]; }
export interface FunctionDefNode extends BaseNode { kind: "FunctionDef"; name: string; returnType: CType; params: { name: string; type: CType }[]; body: BlockNode; }
export interface StructDefNode extends BaseNode { kind: "StructDef"; name: string; fields: { name: string; fieldType: CType }[]; }
export interface VarDeclNode extends BaseNode { kind: "VarDecl"; name: string; varType: CType; init?: ExprNode; }
export interface ReturnStmtNode extends BaseNode { kind: "ReturnStmt"; value?: ExprNode; }
export interface ExprStmtNode extends BaseNode { kind: "ExprStmt"; expr: ExprNode; }
export interface IfStmtNode extends BaseNode { kind: "IfStmt"; condition: ExprNode; then: ASTNode; else_?: ASTNode; }
export interface WhileStmtNode extends BaseNode { kind: "WhileStmt"; condition: ExprNode; body: ASTNode; }
export interface ForStmtNode extends BaseNode { kind: "ForStmt"; init?: ASTNode; condition?: ExprNode; update?: ExprNode; body: ASTNode; }
export interface DoWhileStmtNode extends BaseNode { kind: "DoWhileStmt"; body: ASTNode; condition: ExprNode; }
export interface BlockNode extends BaseNode { kind: "Block"; body: ASTNode[]; }
export interface BreakStmtNode extends BaseNode { kind: "BreakStmt"; }
export interface ContinueStmtNode extends BaseNode { kind: "ContinueStmt"; }

export interface SwitchCaseNode {
  test: ExprNode | null; // null = default
  body: ASTNode[];
}
export interface SwitchStmtNode extends BaseNode { kind: "SwitchStmt"; discriminant: ExprNode; cases: SwitchCaseNode[]; }

export interface NumberLitNode extends BaseNode { kind: "NumberLit"; value: number; isFloat: boolean; }
export interface StringLitNode extends BaseNode { kind: "StringLit"; value: string; }
export interface CharLitNode extends BaseNode { kind: "CharLit"; value: string; }
export interface IdentifierNode extends BaseNode { kind: "Identifier"; name: string; }
export interface BinaryExprNode extends BaseNode { kind: "BinaryExpr"; op: string; left: ExprNode; right: ExprNode; }
export interface UnaryExprNode extends BaseNode { kind: "UnaryExpr"; op: string; operand: ExprNode; }
export interface AssignExprNode extends BaseNode { kind: "AssignExpr"; target: ExprNode; value: ExprNode; }
export interface CompoundAssignExprNode extends BaseNode { kind: "CompoundAssignExpr"; op: string; target: ExprNode; value: ExprNode; }
export interface CallExprNode extends BaseNode { kind: "CallExpr"; callee: string; args: ExprNode[]; }
export interface MemberExprNode extends BaseNode { kind: "MemberExpr"; object: ExprNode; field: string; }
export interface ArrowExprNode extends BaseNode { kind: "ArrowExpr"; object: ExprNode; field: string; }
export interface DerefExprNode extends BaseNode { kind: "DerefExpr"; operand: ExprNode; }
export interface AddrOfExprNode extends BaseNode { kind: "AddrOfExpr"; operand: ExprNode; }
export interface CastExprNode extends BaseNode { kind: "CastExpr"; targetType: CType; operand: ExprNode; }
export interface ArrayAccessNode extends BaseNode { kind: "ArrayAccess"; object: ExprNode; index: ExprNode; }
export interface SizeofExprNode extends BaseNode { kind: "SizeofExpr"; targetType: CType; }
export interface NullLitNode extends BaseNode { kind: "NullLit"; }
export interface TernaryExprNode extends BaseNode { kind: "TernaryExpr"; condition: ExprNode; then: ExprNode; else_: ExprNode; }
export interface PreIncDecNode extends BaseNode { kind: "PreIncDec"; op: "++" | "--"; operand: ExprNode; }
export interface PostIncDecNode extends BaseNode { kind: "PostIncDec"; op: "++" | "--"; operand: ExprNode; }

// --- C++ AST Nodes ---

export interface ClassDefNode extends BaseNode {
  kind: "ClassDef";
  name: string;
  baseClass?: string;
  sections: ClassSection[];
}

export interface ClassSection {
  access: "public" | "private" | "protected";
  members: (FieldDeclNode | MethodDefNode)[];
}

export interface FieldDeclNode extends BaseNode {
  kind: "FieldDecl";
  name: string;
  fieldType: CType;
}

export interface MethodDefNode extends BaseNode {
  kind: "MethodDef";
  className: string;
  name: string;
  returnType: CType;
  params: { name: string; paramType: CType }[];
  body: BlockNode | null;    // null for declarations without body
  isVirtual: boolean;
  isConst: boolean;
  isConstructor: boolean;
  isDestructor: boolean;
  isPureVirtual: boolean;
  initializerList?: { field: string; value: ExprNode }[];
}
