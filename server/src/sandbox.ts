import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface TraceResult {
  steps: unknown[];
  error: string | null;
}

function exec(
  cmd: string,
  args: string[],
  options: { timeout?: number; cwd?: string; env?: NodeJS.ProcessEnv }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, options, (err, stdout, stderr) => {
      if (err) {
        reject(Object.assign(err, { stdout, stderr }));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

function cleanCompilerError(stderr: string, sourceFile: string): string {
  return stderr
    .replace(new RegExp(sourceFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "program")
    .trim()
    .slice(0, 2000);
}

export async function compileAndTrace(
  code: string,
  stdin: string,
  language: "c" | "cpp"
): Promise<TraceResult> {
  const tmpDir = await mkdtemp(join(tmpdir(), "ctrace-"));
  const ext = language === "cpp" ? ".cpp" : ".c";
  const sourceFile = join(tmpDir, `program${ext}`);
  const binaryFile = join(tmpDir, "program");
  const stdinFile = join(tmpDir, "stdin.txt");
  const stdoutFile = join(tmpDir, "stdout.txt");
  const traceFile = join(tmpDir, "trace.json");
  const gdbScript = join(__dirname, "gdb-trace.py");

  try {
    // Write source and input files
    await writeFile(sourceFile, code);
    await writeFile(stdinFile, stdin);
    await writeFile(stdoutFile, "");

    // Compile
    const compiler = language === "cpp" ? "g++" : "gcc";
    try {
      await exec(compiler, ["-g", "-O0", "-o", binaryFile, sourceFile], {
        timeout: 10_000,
        cwd: tmpDir,
      });
    } catch (err: unknown) {
      const compileErr = err as { stderr?: string };
      const msg = compileErr.stderr
        ? cleanCompilerError(compileErr.stderr, sourceFile)
        : "Compilation failed";
      return { steps: [], error: msg };
    }

    // Run GDB tracing
    const gdbArgs = ["--batch", "--quiet", "-x", gdbScript, binaryFile];
    const env = {
      ...process.env,
      TRACE_OUTPUT: traceFile,
      TRACE_STDIN: stdinFile,
      TRACE_STDOUT: stdoutFile,
      TRACE_SOURCE: sourceFile,
      TRACE_MAX_STEPS: "10000",
    };

    try {
      await exec("gdb", gdbArgs, {
        timeout: 15_000,
        cwd: tmpDir,
        env,
      });
    } catch (err: unknown) {
      const gdbErr = err as { killed?: boolean };
      // GDB may exit non-zero but still produce output
      if (gdbErr.killed) {
        // Timeout — try to read partial trace
        try {
          const partial = await readFile(traceFile, "utf-8");
          const result = JSON.parse(partial) as TraceResult;
          result.error = result.error || "Execution timed out";
          return result;
        } catch {
          return { steps: [], error: "Execution timed out" };
        }
      }
      // Non-timeout GDB error — trace may still exist
    }

    // Read trace output
    try {
      const traceJson = await readFile(traceFile, "utf-8");
      return JSON.parse(traceJson) as TraceResult;
    } catch {
      return { steps: [], error: "Failed to read trace output" };
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
