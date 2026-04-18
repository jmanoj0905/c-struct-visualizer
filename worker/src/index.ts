interface Env {
  BACKEND_URL: string;
  API_SECRET: string;
  ALLOWED_ORIGIN: string;
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";
    const headers = corsHeaders(allowedOrigin);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/trace" && request.method === "POST") {
      try {
        const body = await request.text();

        const backendResponse = await fetch(`${env.BACKEND_URL}/api/trace`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": env.API_SECRET || "",
          },
          body,
        });

        const responseBody = await backendResponse.text();

        return new Response(responseBody, {
          status: backendResponse.status,
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
        });
      } catch {
        return new Response(
          JSON.stringify({ steps: [], error: "Backend unavailable" }),
          {
            status: 502,
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    return new Response("Not found", { status: 404, headers });
  },
};
