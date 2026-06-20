import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createClient } from "@supabase/supabase-js";
import { authenticateApiKey, type AuthContext } from "./auth";
import { registerTools } from "./register-tools";

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
  const apiKey = extractApiKey(req);
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Missing Authorization: Bearer <api_key> header" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const db = createServiceClient();

  let auth: AuthContext;
  try {
    auth = await authenticateApiKey(db, apiKey);
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid API key" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const server = new McpServer(
    { name: "threadops", version: "1.0.0" },
    {
      capabilities: { tools: {} },
      instructions:
        "Threadzy MCP server. Manage threads, messages, and webhooks for your company.",
    },
  );

  registerTools(server, db, async () => auth);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);

  try {
    return await transport.handleRequest(req);
  } finally {
    await transport.close();
    await server.close();
  }
}
