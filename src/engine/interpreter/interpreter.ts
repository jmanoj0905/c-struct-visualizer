// AST walker interpreter: executes C AST and records ExecutionStep[]

import type {
  ASTNode, ExprNode, CType, ProgramNode, FunctionDefNode,
  StructDefNode, BlockNode, ClassDefNode, MethodDefNode,
} from "./ast";
import { sizeOfType } from "./ast";
import { Memory, type RuntimeValue } from "./memory";
import { builtinPrintf, builtinMalloc, builtinFree, builtinScanf } from "./builtins";
import type { ExecutionStep } from "../../types/visualizer";

interface ClassInfo {
  name: string;
  baseClass?: string;
  fields: { name: string; type: CType; access: string }[];
  methods: Map<string, MethodInfo>;
  vtable: Map<string, string>;    // methodName → resolvedClassName
  constructors: MethodDefNode[];
  destructor?: MethodDefNode;
  hasVirtualMethods: boolean;
}

interface MethodInfo {
  node: MethodDefNode;
  access: string;
  isVirtual: boolean;
  className: string;
}

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
  private classRegistry = new Map<string, ClassInfo>();
  private outOfClassMethods: MethodDefNode[] = [];
  private memory!: Memory;
  private steps: ExecutionStep[] = [];
  private consoleOutput = "";
  private stepCount = 0;
  private stdinBuffer = "";
  private sourceLines: string[] = [];
  private stackAllocatedObjects: { name: string; addr: number; className: string }[] = [];

  interpret(program: ProgramNode, source: string, stdin: string): ExecutionStep[] {
    this.steps = [];
    this.consoleOutput = "";
    this.stepCount = 0;
    this.stdinBuffer = stdin;
    this.sourceLines = source.split("\n");

    // Phase 1: Register struct defs, class defs, function defs, and out-of-class methods
    for (const node of program.body) {
      if (node.kind === "StructDef") {
        this.structDefs.set(node.name, node);
      } else if (node.kind === "ClassDef") {
        this.registerClass(node);
      } else if (node.kind === "FunctionDef") {
        this.funcDefs.set(node.name, node);
      } else if (node.kind === "MethodDef") {
        this.outOfClassMethods.push(node as MethodDefNode);
      }
    }

    // Register out-of-class method bodies into their classes
    for (const method of this.outOfClassMethods) {
      const classInfo = this.classRegistry.get(method.className);
      if (classInfo) {
        if (method.isConstructor) {
          // Replace or add constructor
          const existing = classInfo.constructors.findIndex(c => c.params.length === method.params.length);
          if (existing >= 0) classInfo.constructors[existing] = method;
          else classInfo.constructors.push(method);
        } else if (method.isDestructor) {
          classInfo.destructor = method;
        } else {
          const info = classInfo.methods.get(method.name);
          if (info) {
            info.node = method; // replace declaration with definition
          } else {
            classInfo.methods.set(method.name, {
              node: method,
              access: "public",
              isVirtual: method.isVirtual,
              className: method.className,
            });
          }
        }
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
    const stackObjsBefore = this.stackAllocatedObjects.length;

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
        this.destroyStackObjects(stackObjsBefore, func.line);
        this.memory.popScope();
        return e.value;
      }
      this.destroyStackObjects(stackObjsBefore, func.line);
      this.memory.popScope();
      throw e;
    }

    this.destroyStackObjects(stackObjsBefore, func.line);
    this.memory.popScope();
    return { value: 0, type: func.returnType };
  }

  private destroyStackObjects(fromIndex: number, line: number) {
    // Destroy in reverse order (LIFO)
    while (this.stackAllocatedObjects.length > fromIndex) {
      const obj = this.stackAllocatedObjects.pop()!;
      const classInfo = this.classRegistry.get(obj.className);
      if (classInfo) {
        this.callDestructorChain(obj.addr, classInfo, line);
      }
      this.memory.free(obj.addr);
    }
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
      case "StructDef":
      case "ClassDef":
        // Already registered in interpret() phase 1
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
    // Stack-allocated class object: allocate on heap, call constructor, store address
    if (node.varType.pointerLevel === 0 && node.varType.isStruct) {
      const classInfo = this.classRegistry.get(node.varType.base);
      if (classInfo) {
        const addr = this.memory.mallocObject(
          node.varType.base,
          classInfo.fields.map(f => ({ name: f.name, type: f.type })),
          classInfo.hasVirtualMethods,
          classInfo.baseClass
            ? this.classRegistry.get(classInfo.baseClass)?.fields.map(f => f.name)
            : undefined,
        );

        // Call default constructor if available
        if (classInfo.constructors.length > 0) {
          const ctor = classInfo.constructors.find(c => c.params.length === 0)
            || classInfo.constructors[0];
          if (ctor) {
            this.callMethod(addr, node.varType.base, ctor, [], node.line);
          }
        }

        const val: RuntimeValue = { value: addr, type: node.varType };
        this.memory.declareVar(node.name, node.varType, val);

        // Track for destructor call on scope exit
        this.stackAllocatedObjects.push({ name: node.name, addr, className: node.varType.base });
        return;
      }
    }

    // Stack-declared array: int arr[N]; — back with a contiguous heap slot block
    // and let the variable hold the base address (decay-to-pointer semantics).
    if (node.varType.arraySize !== undefined) {
      const elemType: CType = { ...node.varType, arraySize: undefined };
      const count = node.varType.arraySize;
      const baseAddr = this.memory.mallocArray(elemType, count, `${node.name}[${count}]`);

      // Apply initializer if present
      if (node.init && node.init.kind === "CallExpr" && node.init.callee === "__array_init") {
        const vals = node.init.args.map(a => this.evalExpr(a));
        for (let i = 0; i < Math.min(vals.length, count); i++) {
          this.memory.setArrayElement(
            baseAddr + i * (this.memory.getHeapBlock(baseAddr)?.elementSize ?? 0),
            vals[i],
          );
        }
      }

      this.memory.declareVar(node.name, node.varType, { value: baseAddr, type: node.varType });
      return;
    }

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
        // C++ special identifiers
        if (expr.name === "endl") {
          const rv: RuntimeValue = { value: 0, type: { base: "char", pointerLevel: 1, isStruct: false } };
          (rv as unknown as { __str: string }).__str = "\n";
          return rv;
        }
        if (expr.name === "cout") {
          return { value: 0, type: { base: "__cout", pointerLevel: 0, isStruct: false } };
        }
        if (expr.name === "cin") {
          return { value: 0, type: { base: "__cin", pointerLevel: 0, isStruct: false } };
        }
        const val = this.memory.getVar(expr.name);
        if (val === undefined) {
          // Check if we're inside a method and this is a field access via implicit `this`
          const thisPtr = this.memory.getVar("this");
          if (thisPtr && thisPtr.value !== null) {
            const field = this.memory.getHeapField(thisPtr.value as number, expr.name);
            if (field) return { ...field, address: thisPtr.value as number };
          }
          throw new InterpreterError(`Undefined variable '${expr.name}'`, expr.line);
        }
        return val;
      }

      case "AssignExpr":
        return this.evalAssign(expr.target, this.evalExpr(expr.value));

      case "CompoundAssignExpr": {
        // Known limitation: lvalue is evaluated twice (once for read, once inside evalAssign),
        // so side effects in the lvalue (e.g., arr[i++] += 1) execute twice. Rare in practice.
        const left = this.evalExpr(expr.target);
        const right = this.evalExpr(expr.value);
        const op = expr.op.slice(0, -1); // "+=" -> "+"
        const result = this.applyBinaryOp(op, left, right);
        return this.evalAssign(expr.target, result);
      }

      case "BinaryExpr": {
        // C++ cout << expr
        if (expr.op === "<<") {
          const left = this.evalExpr(expr.left);
          // Check if left is cout (identifier) or a previous cout << result
          const isCout = (expr.left.kind === "Identifier" && expr.left.name === "cout")
            || (left.type.base === "__cout");
          if (isCout) {
            const right = this.evalExpr(expr.right);
            if (typeof (right as unknown as { __str: string }).__str === "string") {
              this.consoleOutput += (right as unknown as { __str: string }).__str;
            } else if (right.type.base === "char" && right.type.pointerLevel === 0) {
              this.consoleOutput += String.fromCharCode(right.value as number);
            } else {
              this.consoleOutput += String(right.value ?? "");
            }
            // Return a cout-type so chained << keeps working
            return { value: 0, type: { base: "__cout", pointerLevel: 0, isStruct: false } };
          }
        }
        // C++ cin >> var
        if (expr.op === ">>") {
          const left = this.evalExpr(expr.left);
          const isCin = (expr.left.kind === "Identifier" && expr.left.name === "cin")
            || (left.type.base === "__cin");
          if (isCin) {
            // Read a value from stdin
            let inputVal = "";
            const nl = this.stdinBuffer.indexOf("\n");
            const space = this.stdinBuffer.search(/\s/);
            const sepIdx = space >= 0 ? space : (nl >= 0 ? nl : this.stdinBuffer.length);
            inputVal = this.stdinBuffer.substring(0, sepIdx).trim();
            this.stdinBuffer = this.stdinBuffer.substring(sepIdx).replace(/^\s/, "");

            const numVal = Number(inputVal);
            const val: RuntimeValue = { value: isNaN(numVal) ? 0 : numVal, type: intType() };
            this.evalAssign(expr.right, val);
            return { value: 0, type: { base: "__cin", pointerLevel: 0, isStruct: false } };
          }
        }
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
        // Stack-allocated class object: value is the heap address holding fields
        if (obj.type.pointerLevel === 0 && obj.type.isStruct && typeof obj.value === "number") {
          const field = this.memory.getHeapField(obj.value, expr.field);
          if (field) return { ...field, address: obj.value };
        }
        // If object is a heap reference (e.g., dereferenced pointer)
        if (obj.address !== undefined) {
          const field = this.memory.getHeapField(obj.address, expr.field);
          if (field) return { ...field, address: obj.address };
        }
        return { value: 0, type: intType() };
      }

      case "ArrayAccess": {
        const obj = this.evalExpr(expr.object);
        const idx = this.evalExpr(expr.index);
        if (obj.value === null) return { value: 0, type: intType() };

        // Determine element type. Array-typed (arraySize set) decays to pointer-to-element.
        let elemType: CType;
        if (obj.type.arraySize !== undefined) {
          elemType = { ...obj.type, arraySize: undefined };
        } else if (obj.type.pointerLevel > 0) {
          elemType = { ...obj.type, pointerLevel: obj.type.pointerLevel - 1 };
        } else {
          return { value: 0, type: intType() };
        }

        const elemSize = sizeOfType(elemType, this.structDefs);
        const addr = (obj.value as number) + (idx.value as number) * elemSize;

        // Try contiguous-array slot first
        const elem = this.memory.getArrayElement(addr);
        if (elem) return { ...elem, address: addr };

        // Fallback: legacy per-block model (struct arrays via malloc)
        const block = this.memory.getHeapBlock(addr);
        if (block) return { value: addr, type: elemType, address: addr };
        return { value: 0, type: elemType, address: addr };
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
      const existing = this.memory.getVar(target.name);
      if (existing === undefined) {
        // Check if this is an implicit `this->field` assignment
        const thisPtr = this.memory.getVar("this");
        if (thisPtr && thisPtr.value !== null) {
          const field = this.memory.getHeapField(thisPtr.value as number, target.name);
          if (field) {
            this.memory.setHeapField(thisPtr.value as number, target.name, value);
            return value;
          }
        }
      }
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
      // Stack-allocated class object: value is the heap address
      if (obj.type.pointerLevel === 0 && obj.type.isStruct && typeof obj.value === "number") {
        this.memory.setHeapField(obj.value, target.field, value);
      } else if (obj.address !== undefined) {
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
      const obj = this.evalExpr(target.object);
      const idx = this.evalExpr(target.index);
      if (obj.value === null) return value;

      let elemType: CType;
      if (obj.type.arraySize !== undefined) {
        elemType = { ...obj.type, arraySize: undefined };
      } else if (obj.type.pointerLevel > 0) {
        elemType = { ...obj.type, pointerLevel: obj.type.pointerLevel - 1 };
      } else {
        return value;
      }

      const elemSize = sizeOfType(elemType, this.structDefs);
      const addr = (obj.value as number) + (idx.value as number) * elemSize;

      // Prefer slot-array storage; fall back to legacy heap-value write.
      if (!this.memory.setArrayElement(addr, value)) {
        this.memory.setHeapValue(addr, value);
      }
      return value;
    }
    return value;
  }

  private evalCall(name: string, argExprs: ExprNode[], line: number): RuntimeValue {
    // Handle C++ new: __new_ClassName
    if (name.startsWith("__new_")) {
      const className = name.slice(6);
      const args = argExprs.map(a => this.evalExpr(a));
      return this.execNew(className, args, line);
    }

    // Handle C++ delete: __delete
    if (name === "__delete") {
      const args = argExprs.map(a => this.evalExpr(a));
      this.execDelete(args[0], line);
      return { value: 0, type: { base: "void", pointerLevel: 0, isStruct: false } };
    }

    // Handle method calls: __method_arrow_name or __method_dot_name
    if (name.startsWith("__method_arrow_") || name.startsWith("__method_dot_")) {
      const isArrow = name.startsWith("__method_arrow_");
      const methodName = name.slice(isArrow ? 15 : 13);
      const allArgs = argExprs.map(a => this.evalExpr(a));
      const obj = allArgs[0];  // first arg is the object/pointer
      const methodArgs = allArgs.slice(1);

      if (obj.value === null) {
        throw new InterpreterError("Null pointer dereference in method call", line);
      }

      const addr = obj.value as number;
      return this.dispatchMethod(addr, methodName, methodArgs, line);
    }

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

  // --- C++ Class Support ---

  private registerClass(node: ClassDefNode) {
    const classInfo: ClassInfo = {
      name: node.name,
      baseClass: node.baseClass,
      fields: [],
      methods: new Map(),
      vtable: new Map(),
      constructors: [],
      hasVirtualMethods: false,
    };

    // Inherit from base class if any
    if (node.baseClass) {
      const base = this.classRegistry.get(node.baseClass);
      if (base) {
        // Copy base fields
        for (const f of base.fields) {
          classInfo.fields.push({ ...f });
        }
        // Copy base methods
        for (const [name, info] of base.methods) {
          classInfo.methods.set(name, { ...info });
        }
        // Copy vtable
        for (const [name, cls] of base.vtable) {
          classInfo.vtable.set(name, cls);
        }
        if (base.hasVirtualMethods) classInfo.hasVirtualMethods = true;
      }
    }

    // Process sections
    for (const section of node.sections) {
      for (const member of section.members) {
        if (member.kind === "FieldDecl") {
          classInfo.fields.push({
            name: member.name,
            type: member.fieldType,
            access: section.access,
          });
        } else if (member.kind === "MethodDef") {
          if (member.isConstructor) {
            classInfo.constructors.push(member);
          } else if (member.isDestructor) {
            classInfo.destructor = member;
          } else {
            if (member.isVirtual || member.isPureVirtual) {
              classInfo.hasVirtualMethods = true;
            }
            classInfo.methods.set(member.name, {
              node: member,
              access: section.access,
              isVirtual: member.isVirtual || member.isPureVirtual,
              className: node.name,
            });
            // Update vtable: this class's override
            if (member.isVirtual || member.isPureVirtual || classInfo.vtable.has(member.name)) {
              classInfo.vtable.set(member.name, node.name);
            }
          }
        }
      }
    }

    this.classRegistry.set(node.name, classInfo);

    // Also register as a StructDefNode so sizeOfType and heap mapping work
    const structFields = classInfo.fields.map(f => ({ name: f.name, fieldType: f.type }));
    this.structDefs.set(node.name, {
      kind: "StructDef",
      name: node.name,
      fields: structFields,
      line: node.line,
      column: node.column,
    });
  }

  private execNew(className: string, args: RuntimeValue[], line: number): RuntimeValue {
    const classInfo = this.classRegistry.get(className);
    if (!classInfo) {
      // Fallback: treat as struct malloc
      const structDef = this.structDefs.get(className);
      if (structDef) {
        let size = 0;
        for (const f of structDef.fields) size += sizeOfType(f.fieldType, this.structDefs);
        const addr = this.memory.malloc(Math.max(size, 8), className);
        return { value: addr, type: { base: className, pointerLevel: 1, isStruct: true, isClass: true } };
      }
      throw new InterpreterError(`Unknown class '${className}'`, line);
    }

    const baseClassFields = classInfo.baseClass
      ? this.classRegistry.get(classInfo.baseClass)?.fields.map(f => f.name)
      : undefined;

    const addr = this.memory.mallocObject(
      className,
      classInfo.fields.map(f => ({ name: f.name, type: f.type })),
      classInfo.hasVirtualMethods,
      baseClassFields,
    );

    // Call constructor if exists
    if (classInfo.constructors.length > 0) {
      // Find best matching constructor by param count
      const ctor = classInfo.constructors.find(c => c.params.length === args.length)
        || classInfo.constructors[0];
      if (ctor) {
        this.callMethod(addr, className, ctor, args, line);
      }
    }

    return { value: addr, type: { base: className, pointerLevel: 1, isStruct: true, isClass: true } };
  }

  private execDelete(ptr: RuntimeValue, line: number) {
    if (ptr.value === null) return;
    const addr = ptr.value as number;
    const block = this.memory.getHeapBlock(addr);
    if (!block) return;

    const className = block.className || block.typeName;
    const classInfo = this.classRegistry.get(className);

    if (classInfo) {
      // Call destructor chain (derived → base)
      this.callDestructorChain(addr, classInfo, line);
    }

    this.memory.free(addr);
  }

  private callDestructorChain(addr: number, classInfo: ClassInfo, line: number) {
    // Derived destructor first
    if (classInfo.destructor) {
      this.callMethod(addr, classInfo.name, classInfo.destructor, [], line);
    }
    // Then base class destructor
    if (classInfo.baseClass) {
      const base = this.classRegistry.get(classInfo.baseClass);
      if (base) {
        this.callDestructorChain(addr, base, line);
      }
    }
  }

  private callMethod(addr: number, className: string, method: MethodDefNode, args: RuntimeValue[], line: number): RuntimeValue {
    if (!method.body) {
      return { value: 0, type: method.returnType };
    }

    const scopeName = `${className}::${method.name}`;
    this.memory.pushScope(scopeName, line);

    // Bind `this` pointer
    this.memory.declareVar("this", { base: className, pointerLevel: 1, isStruct: true, isClass: true },
      { value: addr, type: { base: className, pointerLevel: 1, isStruct: true, isClass: true } });

    // Bind parameters
    for (let i = 0; i < method.params.length; i++) {
      const param = method.params[i];
      const val = args[i] || { value: 0, type: param.paramType };
      this.memory.declareVar(param.name, param.paramType, { ...val, type: param.paramType });
    }

    // Process initializer list (for constructors)
    if (method.initializerList) {
      for (const init of method.initializerList) {
        const val = this.evalExpr(init.value);
        this.memory.setHeapField(addr, init.field, val);
      }
    }

    try {
      this.execBlock(method.body);
    } catch (e) {
      if (e instanceof ReturnSignal) {
        this.memory.popScope();
        return e.value;
      }
      this.memory.popScope();
      throw e;
    }

    this.memory.popScope();
    return { value: 0, type: method.returnType };
  }

  private dispatchMethod(addr: number, methodName: string, args: RuntimeValue[], line: number): RuntimeValue {
    const block = this.memory.getHeapBlock(addr);
    if (!block) {
      throw new InterpreterError(`Invalid object at address 0x${addr.toString(16)}`, line);
    }

    const className = block.className || block.typeName;
    const classInfo = this.classRegistry.get(className);
    if (!classInfo) {
      throw new InterpreterError(`No class info for '${className}'`, line);
    }

    // Virtual dispatch: look up the most-derived implementation
    let resolvedClassName = className;
    if (classInfo.vtable.has(methodName)) {
      resolvedClassName = classInfo.vtable.get(methodName)!;
    }

    const resolvedClass = this.classRegistry.get(resolvedClassName) || classInfo;
    const methodInfo = resolvedClass.methods.get(methodName) || classInfo.methods.get(methodName);
    if (!methodInfo) {
      throw new InterpreterError(`Method '${methodName}' not found on class '${className}'`, line);
    }

    return this.callMethod(addr, resolvedClassName, methodInfo.node, args, line);
  }
}

function intType(): CType { return { base: "int", pointerLevel: 0, isStruct: false }; }
