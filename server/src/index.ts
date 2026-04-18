import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import pLimit from "p-limit";
import { compileAndTrace } from "./sandbox.js";

const app = new Hono();
const limit = pLimit(4);

const API_KEY = process.env.API_SECRET || "";

// CORS middleware
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["POST", "GET", "OPTIONS"],
    allowHeaders: ["Content-Type", "X-API-Key"],
  })
);

// API key validation
app.use("/api/*", async (c, next) => {
  if (API_KEY) {
    const key = c.req.header("X-API-Key");
    if (key !== API_KEY) {
      return c.json({ error: "Unauthorized" }, 401);
    }
  }
  await next();
});

// Health check
app.get("/health", (c) => {
  return c.json({ ok: true });
});

// Trace endpoint
app.post("/api/trace", async (c) => {
  // Body size check (rough — content-length header)
  const contentLength = parseInt(c.req.header("content-length") || "0", 10);
  if (contentLength > 50_000) {
    return c.json({ error: "Request body too large (max 50KB)" }, 413);
  }

  let body: { code?: string; stdin?: string; language?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { code, stdin = "", language = "c" } = body;

  if (!code || typeof code !== "string") {
    return c.json({ error: "Missing or invalid 'code' field" }, 400);
  }

  if (language !== "c" && language !== "cpp") {
    return c.json({ error: "Language must be 'c' or 'cpp'" }, 400);
  }

  if (code.length > 50_000) {
    return c.json({ error: "Code too large (max 50KB)" }, 413);
  }

  try {
    const result = await limit(() =>
      compileAndTrace(code, stdin, language as "c" | "cpp")
    );
    return c.json(result);
  } catch (err) {
    console.error("Trace error:", err);
    return c.json({ steps: [], error: "Internal server error" }, 500);
  }
});

const port = parseInt(process.env.PORT || "3001", 10);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Trace server listening on port ${port}`);
});
