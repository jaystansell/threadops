import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticateApiKey, type AuthContext } from "./auth";
import { registerTools } from "./register-tools";

function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars",
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

let cachedAuth: AuthContext | null = null;

async function requireAuth(db: SupabaseClient): Promise<AuthContext> {
  if (cachedAuth) return cachedAuth;

  const apiKey = process.env.THREADOPS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing THREADOPS_API_KEY env var. Set it to your Threadzy API key.",
    );
  }
  cachedAuth = await authenticateApiKey(db, apiKey);
  return cachedAuth;
}

const server = new McpServer(
  { name: "threadops", version: "1.0.0" },
  {
    capabilities: { tools: {} },
    instructions:
      "Threadzy MCP server. Provide your API key via the THREADOPS_API_KEY env var.",
  },
);

const db = createServiceClient();

registerTools(server, db, () => requireAuth(db));

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("Threadzy MCP server running on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
