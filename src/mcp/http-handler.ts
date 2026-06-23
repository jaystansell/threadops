import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createClient } from "@supabase/supabase-js";
import { authenticateApiKey, RateLimitError, type AuthContext } from "./auth";
import { registerTools } from "./register-tools";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://threadzy.ai";

const RESOURCE_METADATA_URL = `${BASE_URL}/mcp/.well-known/oauth-protected-resource`;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-API-Key",
};

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars",
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function extractApiKey(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.headers.get("x-api-key");
}

export async function handleMcpRequest(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const apiKey = extractApiKey(req);
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Missing Authorization: Bearer <api_key> header" }),
      {
        status: 401,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
          "WWW-Authenticate": `Bearer resource_metadata="${RESOURCE_METADATA_URL}"`,
        },
      },
    );
  }

  const db = createServiceClient();

  let auth: AuthContext;
  try {
    auth = await authenticateApiKey(db, apiKey);
  } catch (err) {
    if (err instanceof RateLimitError) {
      const retryAfterSec = Math.ceil(err.retryAfterMs / 1000);
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
        {
          status: 429,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
            "Retry-After": String(retryAfterSec),
            "X-RateLimit-Limit": "60",
            "X-RateLimit-Remaining": "0",
          },
        },
      );
    }
    return new Response(
      JSON.stringify({ error: "Invalid API key" }),
      {
        status: 401,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
          "WWW-Authenticate": `Bearer resource_metadata="${RESOURCE_METADATA_URL}"`,
        },
      },
    );
  }

  const server = new McpServer(
    { name: "threadzy", version: "1.0.0" },
    {
      capabilities: { tools: {} },
      instructions:
        "Threadzy.ai MCP server. Working memory for AI agents. Use manage_threads to list/create/search threads, manage_messages to read/post, manage_thread_context to update summaries/tags/metadata, and manage_webhooks to register event endpoints.",
    },
  );

  registerTools(server, db, async () => auth);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);

  try {
    const response = await transport.handleRequest(req);
    // Add CORS headers to MCP transport responses
    const corsResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
      corsResponse.headers.set(k, v);
    }
    return corsResponse;
  } finally {
    await transport.close();
    await server.close();
  }
}
