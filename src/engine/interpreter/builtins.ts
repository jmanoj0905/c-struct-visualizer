// Built-in functions: printf, scanf, malloc, free

import type { RuntimeValue } from "./memory";
import type { Memory } from "./memory";
import type { CType, StructDefNode } from "./ast";
import { sizeOfType } from "./ast";

export type PrintFn = (text: string) => void;
export type ReadFn = () => string;

export function builtinPrintf(
  args: RuntimeValue[],
  _memory: Memory,
  print: PrintFn,
): RuntimeValue {
  if (args.length === 0) return { value: 0, type: intType() };

  // First arg is format string address — but we pass the actual string value through
  // We handle this specially in the interpreter by passing the raw string
  const fmt = args[0];
  let fmtStr = "";

  // If it's a string (passed as a special value), use it directly
  if (typeof (fmt as unknown as { __str: string }).__str === "string") {
    fmtStr = (fmt as unknown as { __str: string }).__str;
  } else {
    fmtStr = String(fmt.value ?? "");
  }

  let argIdx = 1;
  let output = "";

  for (let i = 0; i < fmtStr.length; i++) {
    if (fmtStr[i] === "%" && i + 1 < fmtStr.length) {
      i++;
      // Skip flags/width/precision
      while (i < fmtStr.length && /[0-9.\-+# ]/.test(fmtStr[i])) i++;
      const spec = fmtStr[i];
      const arg = args[argIdx++];
      switch (spec) {
        case "d": case "i":
          output += String(Math.trunc(arg?.value as number ?? 0));
          break;
        case "f":
          output += (arg?.value as number ?? 0).toFixed(6);
          break;
        case "c":
          output += String.fromCharCode(arg?.value as number ?? 0);
          break;
        case "s":
          if (typeof (arg as unknown as { __str: string }).__str === "string") {
            output += (arg as unknown as { __str: string }).__str;
          } else {
            output += String(arg?.value ?? "(null)");
          }
          break;
        case "p":
          output += arg?.value === null ? "(nil)" : `0x${(arg?.value as number).toString(16)}`;
          break;
        case "x":
          output += (arg?.value as number ?? 0).toString(16);
          break;
        case "%":
          output += "%";
          argIdx--;
          break;
        default:
          output += "%" + spec;
      }
    } else {
      output += fmtStr[i];
    }
  }

  print(output);
  return { value: output.length, type: intType() };
}

export function builtinScanf(
  args: RuntimeValue[],
  memory: Memory,
  read: ReadFn,
): RuntimeValue {
  if (args.length < 2) return { value: 0, type: intType() };

  const fmtStr = typeof (args[0] as unknown as { __str: string }).__str === "string"
    ? (args[0] as unknown as { __str: string }).__str
    : String(args[0].value ?? "");

  const input = read();
  const parts = input.trim().split(/\s+/);
  let partIdx = 0;
  let count = 0;

  for (let i = 0; i < fmtStr.length && partIdx < parts.length; i++) {
    if (fmtStr[i] === "%" && i + 1 < fmtStr.length) {
      i++;
      const spec = fmtStr[i];
      const addrArg = args[1 + count];
      if (!addrArg || addrArg.value === null) continue;

      const addr = addrArg.value as number;
      let val: number;

      const varName = memory.findVarNameByAddr(addr);
      if (!varName) continue;

      switch (spec) {
        case "d": case "i":
          val = parseInt(parts[partIdx++]) || 0;
          memory.setVar(varName, { value: val, type: intType() });
          count++;
          break;
        case "f":
          val = parseFloat(parts[partIdx++]) || 0;
          memory.setVar(varName, { value: val, type: floatType() });
          count++;
          break;
        case "c":
          val = (parts[partIdx++] || " ").charCodeAt(0);
          memory.setVar(varName, { value: val, type: charType() });
          count++;
          break;
      }
    }
  }

  return { value: count, type: intType() };
}

export function builtinMalloc(
  args: RuntimeValue[],
  memory: Memory,
  structDefs: Map<string, StructDefNode>,
  typeHint?: string,
): RuntimeValue {
  const size = args[0]?.value as number ?? 8;

  // Try to infer struct type from size or hint
  let typeName = typeHint;
  if (!typeName) {
    for (const [name, def] of structDefs) {
      let structSize = 0;
      for (const f of def.fields) structSize += sizeOfType(f.fieldType, structDefs);
      if (structSize === size || Math.abs(structSize - size) < 8) {
        typeName = name;
        break;
      }
    }
  }

  const addr = memory.malloc(size, typeName);
  return {
    value: addr,
    type: {
      base: typeName || "void",
      pointerLevel: 1,
      isStruct: !!typeName,
    },
  };
}

export function builtinFree(args: RuntimeValue[], memory: Memory): RuntimeValue {
  const addr = args[0]?.value;
  if (addr !== null && addr !== undefined) {
    memory.free(addr as number);
  }
  return { value: 0, type: voidType() };
}

function intType(): CType { return { base: "int", pointerLevel: 0, isStruct: false }; }
function floatType(): CType { return { base: "float", pointerLevel: 0, isStruct: false }; }
function charType(): CType { return { base: "char", pointerLevel: 0, isStruct: false }; }
function voidType(): CType { return { base: "void", pointerLevel: 0, isStruct: false }; }
