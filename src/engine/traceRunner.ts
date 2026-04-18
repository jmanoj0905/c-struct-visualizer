import type { ExecutionStep } from "../types/visualizer";
import { tokenize } from "./interpreter/lexer";
import { Parser } from "./interpreter/parser";
import { Interpreter, InterpreterError } from "./interpreter/interpreter";
import { remoteComputeTrace } from "./remoteTrace";

export interface TraceResult {
  steps: ExecutionStep[];
  error: string | null;
}

/**
 * Detects whether the code is C or C++ based on keyword presence.
 */
export function detectLanguage(code: string): "c" | "cpp" {
  if (/\bclass\b/.test(code) || /\bnew\b/.test(code) || /\bcout\b/.test(code) || /\bnullptr\b/.test(code)) {
    return "cpp";
  }
  return "c";
}

/**
 * Runs the given C/C++ code through the remote GDB-based tracer,
 * falling back to the local JS interpreter if the remote is unavailable.
 */
export async function computeTrace(
  code: string,
  stdin: string,
): Promise<TraceResult> {
  const language = detectLanguage(code);

  const apiUrl = import.meta.env.VITE_TRACE_API_URL;

  // Try remote GDB-based tracing first
  if (apiUrl) {
    try {
      return await remoteComputeTrace(code, stdin, language);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("Remote trace failed:", msg);

      // If the server is configured but unreachable, show a helpful error
      // instead of silently falling back to the limited local interpreter
      if (msg.includes("fetch") || msg.includes("NetworkError") || msg.includes("Failed to fetch") || msg.includes("abort")) {
        return {
          steps: [],
          error: `Could not connect to the trace server at ${apiUrl}. Make sure it is running (docker-compose up --build).`,
        };
      }

      // For server-side errors (compilation errors, etc.), show them directly
      return { steps: [], error: msg };
    }
  }

  // Fallback: local JS interpreter (limited — no STL, templates, etc.)
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

    // If the API URL is not set at all, hint that the server isn't configured
    if (!apiUrl) {
      return {
        steps: [],
        error: `Local interpreter error: ${message}\n\nFor full C/C++ support, set VITE_TRACE_API_URL in .env and run the trace server (docker-compose up --build).`,
      };
    }

    return { steps: [], error: `Error: ${message}` };
  }
}
