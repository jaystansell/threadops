const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://threadzy.ai";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * GET /.well-known/oauth-protected-resource/mcp
 *
 * RFC 9728 Protected Resource Metadata (standard path).
 * Path format: /.well-known/oauth-protected-resource{resource-path}
 * where resource-path is /mcp.
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
