// Memory model: heap + stack with snapshot capability

import type { CType, StructDefNode } from "./ast";
import { typeToString, sizeOfType } from "./ast";
import type { VariableSnapshot, StackFrame, HeapObject } from "../../types/visualizer";

export interface RuntimeValue {
  value: number | null;  // null = NULL pointer, numbers for everything else
  type: CType;
  address?: number;      // for lvalues: where this value lives
}

interface StackVar {
  value: RuntimeValue;
  name: string;
}

interface ScopeFrame {
  functionName: string;
  line: number;
  vars: Map<string, StackVar>;
}

interface HeapBlock {
  address: number;
  typeName: string;
  isStruct: boolean;
  fields: Map<string, RuntimeValue>;
  freed: boolean;
  structDef?: StructDefNode;
}

export class Memory {
  private stack: ScopeFrame[] = [];
  private heap: Map<number, HeapBlock> = new Map();
  private nextAddr = 0x1000;
  private structDefs: Map<string, StructDefNode>;
  private stringTable: Map<string, number> = new Map();

  constructor(structDefs: Map<string, StructDefNode>) {
    this.structDefs = structDefs;
  }

  // --- Stack operations ---

  pushScope(functionName: string, line: number) {
    this.stack.push({ functionName, line, vars: new Map() });
  }

  popScope() {
    this.stack.pop();
  }

  declareVar(name: string, type: CType, value?: RuntimeValue) {
    const frame = this.stack[this.stack.length - 1];
    if (!frame) return;
    const addr = this.allocAddress(sizeOfType(type, this.structDefs));
    const val: RuntimeValue = value || { value: 0, type, address: addr };
    val.address = addr;
    frame.vars.set(name, { value: val, name });
  }

  setVar(name: string, value: RuntimeValue) {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const v = this.stack[i].vars.get(name);
      if (v) {
        const addr = v.value.address;
        v.value = { ...value, address: addr };
        return;
      }
    }
  }

  getVar(name: string): RuntimeValue | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const v = this.stack[i].vars.get(name);
      if (v) return v.value;
    }
    return undefined;
  }

  // --- Heap operations ---

  malloc(size: number, typeName?: string): number {
    const addr = this.allocAddress(Math.max(size, 8));
    const structDef = typeName ? this.structDefs.get(typeName) : undefined;
    const block: HeapBlock = {
      address: addr,
      typeName: typeName || "unknown",
      isStruct: !!structDef,
      fields: new Map(),
      freed: false,
      structDef,
    };

    // Initialize struct fields
    if (structDef) {
      for (const f of structDef.fields) {
        const defaultVal: RuntimeValue = {
          value: f.fieldType.pointerLevel > 0 ? null : 0,
          type: f.fieldType,
        };
        block.fields.set(f.name, defaultVal);
      }
    }

    this.heap.set(addr, block);
    return addr;
  }

  free(addr: number) {
    const block = this.heap.get(addr);
    if (block) block.freed = true;
  }

  getHeapField(addr: number, field: string): RuntimeValue | undefined {
    const block = this.heap.get(addr);
    if (!block || block.freed) return undefined;
    return block.fields.get(field);
  }

  setHeapField(addr: number, field: string, value: RuntimeValue) {
    const block = this.heap.get(addr);
    if (!block || block.freed) return;
    block.fields.set(field, value);
  }

  getHeapBlock(addr: number): HeapBlock | undefined {
    return this.heap.get(addr);
  }

  // For array-style heap access (non-struct malloc)
  getHeapValue(addr: number): RuntimeValue | undefined {
    const block = this.heap.get(addr);
    if (!block || block.freed) return undefined;
    // Use "__value" as default field for non-struct allocations
    return block.fields.get("__value");
  }

  setHeapValue(addr: number, value: RuntimeValue) {
    const block = this.heap.get(addr);
    if (!block || block.freed) return;
    block.fields.set("__value", value);
  }

  allocStringLiteral(str: string): number {
    const existing = this.stringTable.get(str);
    if (existing !== undefined) return existing;
    const addr = this.allocAddress(str.length + 1);
    this.stringTable.set(str, addr);
    return addr;
  }

  // --- Snapshot methods ---

  snapshotStackVariables(): VariableSnapshot[] {
    const vars: VariableSnapshot[] = [];
    for (const frame of this.stack) {
      for (const [, sv] of frame.vars) {
        const ts = typeToString(sv.value.type);
        const isPointer = sv.value.type.pointerLevel > 0;
        let displayValue: string;
        if (isPointer) {
          displayValue = sv.value.value === null ? "NULL" : `0x${(sv.value.value as number).toString(16)}`;
        } else if (sv.value.type.base === "char" && sv.value.type.pointerLevel === 0) {
          displayValue = sv.value.value !== null ? `'${String.fromCharCode(sv.value.value as number)}'` : "0";
        } else if (sv.value.type.base === "float" || sv.value.type.base === "double") {
          displayValue = sv.value.value !== null ? (sv.value.value as number).toString() : "0";
        } else {
          displayValue = sv.value.value !== null ? String(sv.value.value) : "0";
        }
        vars.push({
          name: sv.name,
          type: ts,
          value: displayValue,
          isPointer,
          pointerLevel: sv.value.type.pointerLevel,
          pointsTo: isPointer && sv.value.value !== null ? (sv.value.value as number) : undefined,
        });
      }
    }
    return vars;
  }

  snapshotCallStack(): StackFrame[] {
    return this.stack.map(frame => ({
      functionName: frame.functionName,
      line: frame.line,
      variables: Array.from(frame.vars.values()).map(sv => {
        const ts = typeToString(sv.value.type);
        const isPointer = sv.value.type.pointerLevel > 0;
        return {
          name: sv.name,
          type: ts,
          value: sv.value.value !== null ? String(sv.value.value) : "NULL",
          isPointer,
          pointerLevel: sv.value.type.pointerLevel,
          pointsTo: isPointer && sv.value.value !== null ? (sv.value.value as number) : undefined,
        };
      }),
    }));
  }

  snapshotHeap(): HeapObject[] {
    const objects: HeapObject[] = [];
    for (const [, block] of this.heap) {
      const fields: Record<string, { value: string; type: string; isPointer: boolean; pointerLevel: number; pointsTo?: number }> = {};
      for (const [fname, fval] of block.fields) {
        if (fname === "__value") continue;
        const isPointer = fval.type.pointerLevel > 0;
        fields[fname] = {
          value: isPointer ? (fval.value === null ? "NULL" : `0x${(fval.value as number).toString(16)}`) : String(fval.value ?? 0),
          type: typeToString(fval.type),
          isPointer,
          pointerLevel: fval.type.pointerLevel,
          pointsTo: isPointer && fval.value !== null ? (fval.value as number) : undefined,
        };
      }
      objects.push({
        address: block.address,
        typeName: block.typeName,
        isStruct: block.isStruct,
        fields,
        freed: block.freed,
      });
    }
    return objects;
  }

  findVarNameByAddr(addr: number): string | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      for (const [name, sv] of this.stack[i].vars) {
        if (sv.value.address === addr) return name;
      }
    }
    return undefined;
  }

  updateCurrentLine(line: number) {
    if (this.stack.length > 0) {
      this.stack[this.stack.length - 1].line = line;
    }
  }

  private allocAddress(size: number): number {
    const addr = this.nextAddr;
    this.nextAddr += Math.max(size, 8);
    // Align to 8 bytes
    this.nextAddr = (this.nextAddr + 7) & ~7;
    return addr;
  }
}
