import type { TraceResult } from "./traceRunner";

export async function remoteComputeTrace(
  code: string,
  stdin: string,
  language: "c" | "cpp"
): Promise<TraceResult> {
  const url = import.meta.env.VITE_TRACE_API_URL;
  if (!url) {
    throw new Error("Remote trace API URL not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(`${url}/api/trace`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, stdin, language }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        (body as { error?: string }).error || `Server error: ${response.status}`
      );
    }

    return (await response.json()) as TraceResult;
  } finally {
    clearTimeout(timeout);
  }
}
