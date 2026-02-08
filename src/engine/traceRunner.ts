import type { ExecutionStep } from "../types/visualizer";
import { tokenize } from "./interpreter/lexer";
import { Parser } from "./interpreter/parser";
import { Interpreter, InterpreterError } from "./interpreter/interpreter";

export interface TraceResult {
  steps: ExecutionStep[];
  error: string | null;
}

/**
 * Runs the given C code through the custom interpreter and collects
 * an execution trace (one step per statement).
 */
export async function computeTrace(
  code: string,
  stdin: string,
): Promise<TraceResult> {
  try {
    const tokens = tokenize(code);
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const steps = interpreter.interpret(ast, code, stdin);

    if (steps.length === 0) {
      return { steps: [], error: "No execution steps produced. Does the program have a main() function?" };
    }

    return { steps, error: null };
  } catch (err: unknown) {
    if (err instanceof InterpreterError) {
      return { steps: [], error: err.message };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { steps: [], error: `Error: ${message}` };
  }
}
