const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://threadzy.ai";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * GET /mcp/.well-known/oauth-protected-resource
 *
 * RFC 9728 Protected Resource Metadata.
 * MCP clients discover which OAuth authorization server protects
 * the /mcp endpoint by fetching this document first.
 */
export async function GET() {
  return Response.json(
    {
      resource: `${BASE_URL}/mcp`,
      authorization_servers: [BASE_URL],
      bearer_methods_supported: ["header"],
      scopes_supported: [
        "threads:read",
        "threads:write",
        "messages:read",
        "messages:write",
        "webhooks:read",
      ],
    },
    { headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
