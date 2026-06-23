const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://threadzy.ai";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function GET() {
  return Response.json(
    {
      issuer: BASE_URL,
      authorization_endpoint: `${BASE_URL}/oauth/authorize`,
      token_endpoint: `${BASE_URL}/api/oauth/token`,
      token_endpoint_auth_methods_supported: [
        "client_secret_post",
        "client_secret_basic",
      ],
      grant_types_supported: ["authorization_code", "client_credentials"],
      response_types_supported: ["code"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: [
        "threads:read",
        "threads:write",
        "messages:read",
        "messages:write",
        "webhooks:read",
      ],
      service_documentation: `${BASE_URL}/docs/api`,
    },
    { headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
