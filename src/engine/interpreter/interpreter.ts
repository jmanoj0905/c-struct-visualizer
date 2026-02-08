// AST walker interpreter: executes C AST and records ExecutionStep[]

import type {
  ASTNode, ExprNode, CType, ProgramNode, FunctionDefNode,
  StructDefNode, BlockNode,
} from "./ast";
import { sizeOfType } from "./ast";
import { Memory, type RuntimeValue } from "./memory";
import { builtinPrintf, builtinMalloc, builtinFree, builtinScanf } from "./builtins";
import type { ExecutionStep } from "../../types/visualizer";

const MAX_STEPS = 10_000;

class BreakSignal { }
class ContinueSignal { }
class ReturnSignal {
  value: RuntimeValue;
  constructor(value: RuntimeValue) { this.value = value; }
}

export class InterpreterError extends Error {
  line: number;
  constructor(message: string, line: number) {
    super(`Runtime error at line ${line}: ${message}`);
    this.line = line;
  }
}

export class Interpreter {
  private structDefs = new Map<string, StructDefNode>();
  private funcDefs = new Map<string, FunctionDefNode>();
  private memory!: Memory;
  private steps: ExecutionStep[] = [];
  private consoleOutput = "";
  private stepCount = 0;
  private stdinBuffer = "";
  private sourceLines: string[] = [];

  interpret(program: ProgramNode, source: string, stdin: string): ExecutionStep[] {
    this.steps = [];
    this.consoleOutput = "";
    this.stepCount = 0;
    this.stdinBuffer = stdin;
    this.sourceLines = source.split("\n");

    // Phase 1: Register struct defs and function defs
    for (const node of program.body) {
      if (node.kind === "StructDef") {
        this.structDefs.set(node.name, node);
      } else if (node.kind === "FunctionDef") {
        this.funcDefs.set(node.name, node);
      }
    }

    this.memory = new Memory(this.structDefs);

    // Phase 2: Execute global variable declarations
    this.memory.pushScope("__global", 0);
    for (const node of program.body) {
      if (node.kind === "VarDecl") {
        this.execVarDecl(node);
      }
    }

    // Phase 3: Call main()
    const mainFn = this.funcDefs.get("main");
    if (!mainFn) {
      throw new InterpreterError("No main() function found", 0);
    }

    try {
      this.callFunction(mainFn, []);
    } catch (e) {
      if (e instanceof ReturnSignal) {
        // main returned
      } else {
        throw e;
      }
    }

    this.memory.popScope(); // global

    return this.steps;
  }

  private recordStep(line: number) {
    if (this.stepCount >= MAX_STEPS) {
      throw new InterpreterError(`Execution exceeded ${MAX_STEPS} steps`, line);
    }

    this.memory.updateCurrentLine(line);

    const stmt = this.sourceLines[line - 1]?.trim() || "";

    this.steps.push({
      index: this.stepCount,
      line,
      column: 0,
      statement: stmt,
      consoleOutput: this.consoleOutput,
      callStack: this.memory.snapshotCallStack(),
      heapObjects: this.memory.snapshotHeap(),
      stackVariables: this.memory.snapshotStackVariables(),
    });

    this.stepCount++;
  }

  private callFunction(func: FunctionDefNode, args: RuntimeValue[]): RuntimeValue {
    this.memory.pushScope(func.name, func.line);

    // Bind parameters
    for (let i = 0; i < func.params.length; i++) {
      const param = func.params[i];
      const val = args[i] || { value: 0, type: param.type };
      this.memory.declareVar(param.name, param.type, { ...val, type: param.type });
    }

    try {
      this.execBlock(func.body);
    } catch (e) {
      if (e instanceof ReturnSignal) {
        this.memory.popScope();
        return e.value;
      }
      this.memory.popScope();
      throw e;
    }

    this.memory.popScope();
    return { value: 0, type: func.returnType };
  }

  private execBlock(block: BlockNode) {
    for (const stmt of block.body) {
      this.execStatement(stmt);
    }
  }

  private execStatement(node: ASTNode) {
    switch (node.kind) {
      case "VarDecl":
        this.recordStep(node.line);
        this.execVarDecl(node);
        break;
      case "ExprStmt":
        this.recordStep(node.line);
        this.evalExpr(node.expr);
        break;
      case "ReturnStmt":
        this.recordStep(node.line);
        {
          const val = node.value ? this.evalExpr(node.value) : { value: 0, type: { base: "void", pointerLevel: 0, isStruct: false } as CType };
          throw new ReturnSignal(val);
        }
      case "IfStmt":
        this.recordStep(node.line);
        {
          const cond = this.evalExpr(node.condition);
          if (this.isTruthy(cond)) {
            this.execStatement(node.then);
          } else if (node.else_) {
            this.execStatement(node.else_);
          }
        }
        break;
      case "WhileStmt":
        while (true) {
          this.recordStep(node.line);
          const cond = this.evalExpr(node.condition);
          if (!this.isTruthy(cond)) break;
          try {
            this.execStatement(node.body);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        }
        break;
      case "ForStmt":
        if (node.init) this.execStatement(node.init);
        while (true) {
          if (node.condition) {
            this.recordStep(node.line);
            const cond = this.evalExpr(node.condition);
            if (!this.isTruthy(cond)) break;
          } else {
            this.recordStep(node.line);
          }
          try {
            this.execStatement(node.body);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) { /* fall through to update */ }
            else throw e;
          }
          if (node.update) this.evalExpr(node.update);
        }
        break;
      case "DoWhileStmt":
        do {
          try {
            this.execStatement(node.body);
          } catch (e) {
            if (e instanceof BreakSignal) return;
            if (e instanceof ContinueSignal) { /* continue */ }
            else throw e;
          }
          this.recordStep(node.line);
        } while (this.isTruthy(this.evalExpr(node.condition)));
        break;
      case "Block":
        this.execBlock(node);
        break;
      case "BreakStmt":
        this.recordStep(node.line);
        throw new BreakSignal();
      case "ContinueStmt":
        this.recordStep(node.line);
        throw new ContinueSignal();
      default:
        break;
    }
  }

  private execVarDecl(node: ASTNode & { kind: "VarDecl" }) {
    let initVal: RuntimeValue | undefined;
    if (node.init) {
      if (node.init.kind === "CallExpr" && node.init.callee === "__array_init") {
        // Array initializer
        const vals = node.init.args.map(a => this.evalExpr(a));
        // Store first element as value for simplicity
        initVal = vals[0] || { value: 0, type: node.varType };
        initVal = { ...initVal, type: node.varType };
      } else {
        initVal = this.evalExpr(node.init);
        // Coerce type if needed (e.g., cast result)
        initVal = { ...initVal, type: node.varType };
      }
    }
    this.memory.declareVar(node.name, node.varType, initVal);
  }

  evalExpr(expr: ExprNode): RuntimeValue {
    switch (expr.kind) {
      case "NumberLit":
        return {
          value: expr.value,
          type: {
            base: expr.isFloat ? "double" : "int",
            pointerLevel: 0,
            isStruct: false,
          },
        };

      case "StringLit": {
        const addr = this.memory.allocStringLiteral(expr.value);
        const rv: RuntimeValue = {
          value: addr,
          type: { base: "char", pointerLevel: 1, isStruct: false },
        };
        // Attach string value for printf
        (rv as unknown as { __str: string }).__str = expr.value;
        return rv;
      }

      case "CharLit":
        return {
          value: expr.value.charCodeAt(0),
          type: { base: "char", pointerLevel: 0, isStruct: false },
        };

      case "NullLit":
        return { value: null, type: { base: "void", pointerLevel: 1, isStruct: false } };

      case "Identifier": {
        const val = this.memory.getVar(expr.name);
        if (val === undefined) {
          throw new InterpreterError(`Undefined variable '${expr.name}'`, expr.line);
        }
        return val;
      }

      case "AssignExpr":
        return this.evalAssign(expr.target, this.evalExpr(expr.value));

      case "CompoundAssignExpr": {
        const left = this.evalExpr(expr.target);
        const right = this.evalExpr(expr.value);
        const op = expr.op.slice(0, -1); // "+=" -> "+"
        const result = this.applyBinaryOp(op, left, right);
        return this.evalAssign(expr.target, result);
      }

      case "BinaryExpr": {
        // Short-circuit for && and ||
        if (expr.op === "&&") {
          const left = this.evalExpr(expr.left);
          if (!this.isTruthy(left)) return { value: 0, type: intType() };
          return { value: this.isTruthy(this.evalExpr(expr.right)) ? 1 : 0, type: intType() };
        }
        if (expr.op === "||") {
          const left = this.evalExpr(expr.left);
          if (this.isTruthy(left)) return { value: 1, type: intType() };
          return { value: this.isTruthy(this.evalExpr(expr.right)) ? 1 : 0, type: intType() };
        }
        const left = this.evalExpr(expr.left);
        const right = this.evalExpr(expr.right);
        return this.applyBinaryOp(expr.op, left, right);
      }

      case "UnaryExpr": {
        const operand = this.evalExpr(expr.operand);
        switch (expr.op) {
          case "-": return { value: -(operand.value as number), type: operand.type };
          case "!": return { value: this.isTruthy(operand) ? 0 : 1, type: intType() };
          case "~": return { value: ~(operand.value as number), type: intType() };
          default: return operand;
        }
      }

      case "DerefExpr": {
        const ptr = this.evalExpr(expr.operand);
        if (ptr.value === null) {
          throw new InterpreterError("Null pointer dereference", expr.line);
        }
        const addr = ptr.value as number;
        const block = this.memory.getHeapBlock(addr);
        if (block && block.isStruct) {
          // Return the address as a "struct reference"
          return {
            value: addr,
            type: { base: ptr.type.base, pointerLevel: ptr.type.pointerLevel - 1, isStruct: true },
            address: addr,
          };
        }
        const val = this.memory.getHeapValue(addr);
        return val || { value: 0, type: { ...ptr.type, pointerLevel: ptr.type.pointerLevel - 1 } };
      }

      case "AddrOfExpr": {
        // Get address of variable
        if (expr.operand.kind === "Identifier") {
          const val = this.memory.getVar(expr.operand.name);
          if (val?.address !== undefined) {
            return {
              value: val.address,
              type: { ...val.type, pointerLevel: val.type.pointerLevel + 1 },
            };
          }
        }
        // Fallback
        const operand = this.evalExpr(expr.operand);
        return {
          value: operand.address ?? operand.value,
          type: { ...operand.type, pointerLevel: operand.type.pointerLevel + 1 },
        };
      }

      case "CastExpr": {
        const operand = this.evalExpr(expr.operand);
        return { ...operand, type: expr.targetType };
      }

      case "SizeofExpr":
        return {
          value: sizeOfType(expr.targetType, this.structDefs),
          type: intType(),
        };

      case "CallExpr":
        return this.evalCall(expr.callee, expr.args, expr.line);

      case "ArrowExpr": {
        const obj = this.evalExpr(expr.object);
        if (obj.value === null) {
          throw new InterpreterError("Null pointer dereference (->)", expr.line);
        }
        const field = this.memory.getHeapField(obj.value as number, expr.field);
        if (field === undefined) {
          throw new InterpreterError(`Field '${expr.field}' not found on struct at address 0x${(obj.value as number).toString(16)}`, expr.line);
        }
        // Tag with address info for assignment
        return { ...field, address: obj.value as number, type: { ...field.type } };
      }

      case "MemberExpr": {
        const obj = this.evalExpr(expr.object);
        // If object is a heap reference
        if (obj.address !== undefined) {
          const field = this.memory.getHeapField(obj.address, expr.field);
          if (field) return { ...field, address: obj.address };
        }
        return { value: 0, type: intType() };
      }

      case "ArrayAccess": {
        const obj = this.evalExpr(expr.object);
        const idx = this.evalExpr(expr.index);
        // Pointer arithmetic: base + index * element_size
        if (obj.type.pointerLevel > 0 && obj.value !== null) {
          const elemType: CType = { ...obj.type, pointerLevel: obj.type.pointerLevel - 1 };
          const elemSize = sizeOfType(elemType, this.structDefs);
          const addr = (obj.value as number) + (idx.value as number) * elemSize;
          const block = this.memory.getHeapBlock(addr);
          if (block) {
            return { value: addr, type: elemType, address: addr };
          }
        }
        return { value: 0, type: intType() };
      }

      case "TernaryExpr": {
        const cond = this.evalExpr(expr.condition);
        return this.isTruthy(cond) ? this.evalExpr(expr.then) : this.evalExpr(expr.else_);
      }

      case "PreIncDec": {
        const val = this.evalExpr(expr.operand);
        const delta = expr.op === "++" ? 1 : -1;
        const newVal: RuntimeValue = { ...val, value: (val.value as number) + delta };
        this.evalAssign(expr.operand, newVal);
        return newVal;
      }

      case "PostIncDec": {
        const val = this.evalExpr(expr.operand);
        const delta = expr.op === "++" ? 1 : -1;
        const newVal: RuntimeValue = { ...val, value: (val.value as number) + delta };
        this.evalAssign(expr.operand, newVal);
        return val; // return old value
      }

      default:
        return { value: 0, type: intType() };
    }
  }

  private evalAssign(target: ExprNode, value: RuntimeValue): RuntimeValue {
    if (target.kind === "Identifier") {
      this.memory.setVar(target.name, value);
      return value;
    }
    if (target.kind === "ArrowExpr") {
      const obj = this.evalExpr(target.object);
      if (obj.value !== null) {
        this.memory.setHeapField(obj.value as number, target.field, value);
      }
      return value;
    }
    if (target.kind === "MemberExpr") {
      const obj = this.evalExpr(target.object);
      if (obj.address !== undefined) {
        this.memory.setHeapField(obj.address, target.field, value);
      }
      return value;
    }
    if (target.kind === "DerefExpr") {
      const ptr = this.evalExpr(target.operand);
      if (ptr.value !== null) {
        this.memory.setHeapValue(ptr.value as number, value);
      }
      return value;
    }
    if (target.kind === "ArrayAccess") {
      // TODO: array element assignment
      return value;
    }
    return value;
  }

  private evalCall(name: string, argExprs: ExprNode[], line: number): RuntimeValue {
    const args = argExprs.map(a => this.evalExpr(a));

    switch (name) {
      case "printf":
        return builtinPrintf(args, this.memory, (text) => { this.consoleOutput += text; });
      case "scanf":
        return builtinScanf(args, this.memory, () => {
          const nl = this.stdinBuffer.indexOf("\n");
          if (nl === -1) {
            const line = this.stdinBuffer;
            this.stdinBuffer = "";
            return line;
          }
          const line = this.stdinBuffer.substring(0, nl);
          this.stdinBuffer = this.stdinBuffer.substring(nl + 1);
          return line;
        });
      case "malloc": {
        // Try to infer struct type from the cast context
        // We look at sizeof arg to guess type
        let typeHint: string | undefined;
        if (argExprs.length > 0 && argExprs[0].kind === "SizeofExpr") {
          const sizeofType = argExprs[0].targetType;
          if (sizeofType.isStruct) typeHint = sizeofType.base;
        }
        return builtinMalloc(args, this.memory, this.structDefs, typeHint);
      }
      case "free":
        return builtinFree(args, this.memory);
      case "calloc": {
        const count = args[0]?.value as number ?? 1;
        const size = args[1]?.value as number ?? 4;
        return builtinMalloc(
          [{ value: count * size, type: intType() }],
          this.memory, this.structDefs,
        );
      }
      case "atoi":
        return { value: parseInt(String(args[0]?.value ?? "0")) || 0, type: intType() };
      case "abs":
        return { value: Math.abs(args[0]?.value as number ?? 0), type: intType() };
      default: {
        // User-defined function
        const func = this.funcDefs.get(name);
        if (!func) {
          throw new InterpreterError(`Undefined function '${name}'`, line);
        }
        return this.callFunction(func, args);
      }
    }
  }

  private applyBinaryOp(op: string, left: RuntimeValue, right: RuntimeValue): RuntimeValue {
    const lv = left.value as number ?? 0;
    const rv = right.value as number ?? 0;
    const isPtr = left.type.pointerLevel > 0 || right.type.pointerLevel > 0;

    switch (op) {
      case "+":
        if (left.type.pointerLevel > 0 && right.type.pointerLevel === 0) {
          // Pointer arithmetic
          const elemSize = sizeOfType({ ...left.type, pointerLevel: left.type.pointerLevel - 1 }, this.structDefs);
          return { value: lv + rv * elemSize, type: left.type };
        }
        return { value: lv + rv, type: this.promoteType(left.type, right.type) };
      case "-":
        if (left.type.pointerLevel > 0 && right.type.pointerLevel > 0) {
          // Pointer difference
          return { value: lv - rv, type: intType() };
        }
        return { value: lv - rv, type: this.promoteType(left.type, right.type) };
      case "*": return { value: lv * rv, type: this.promoteType(left.type, right.type) };
      case "/": return { value: rv !== 0 ? (left.type.base === "int" && right.type.base === "int" ? Math.trunc(lv / rv) : lv / rv) : 0, type: this.promoteType(left.type, right.type) };
      case "%": return { value: rv !== 0 ? lv % rv : 0, type: intType() };
      case "==": return { value: (isPtr ? left.value === right.value : lv === rv) ? 1 : 0, type: intType() };
      case "!=": return { value: (isPtr ? left.value !== right.value : lv !== rv) ? 1 : 0, type: intType() };
      case "<": return { value: lv < rv ? 1 : 0, type: intType() };
      case ">": return { value: lv > rv ? 1 : 0, type: intType() };
      case "<=": return { value: lv <= rv ? 1 : 0, type: intType() };
      case ">=": return { value: lv >= rv ? 1 : 0, type: intType() };
      case "&": return { value: lv & rv, type: intType() };
      case "|": return { value: lv | rv, type: intType() };
      case "^": return { value: lv ^ rv, type: intType() };
      case "<<": return { value: lv << rv, type: intType() };
      case ">>": return { value: lv >> rv, type: intType() };
      default: return { value: 0, type: intType() };
    }
  }

  private promoteType(a: CType, b: CType): CType {
    if (a.base === "double" || b.base === "double") return { base: "double", pointerLevel: 0, isStruct: false };
    if (a.base === "float" || b.base === "float") return { base: "float", pointerLevel: 0, isStruct: false };
    return { base: "int", pointerLevel: 0, isStruct: false };
  }

  private isTruthy(val: RuntimeValue): boolean {
    if (val.value === null) return false;
    return val.value !== 0;
  }
}

function intType(): CType { return { base: "int", pointerLevel: 0, isStruct: false }; }
