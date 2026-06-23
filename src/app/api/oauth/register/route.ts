import { randomBytes } from "crypto";
import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { checkRateLimit } from "@/core/rules/rate-limit";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * POST /api/oauth/register
 *
 * RFC 7591 Dynamic Client Registration.
 * MCP clients call this to register themselves and receive a client_id
 * before starting the authorization_code flow.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(`oauth_register:${ip}`, { maxRequests: 10 });
  if (!rl.allowed) {
    return Response.json(
      { error: "rate_limit_exceeded", error_description: "Too many registration requests" },
      {
        status: 429,
        headers: {
          ...CORS_HEADERS,
          "Retry-After": String(Math.ceil(rl.retryAfterMs! / 1000)),
        },
      },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "invalid_client_metadata", error_description: "Invalid JSON" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const redirectUris = body.redirect_uris as string[] | undefined;
  if (
    !redirectUris ||
    !Array.isArray(redirectUris) ||
    redirectUris.length === 0
  ) {
    return Response.json(
      {
        error: "invalid_client_metadata",
        error_description: "redirect_uris is required and must be a non-empty array",
      },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Validate each redirect_uri is a valid URL
  for (const uri of redirectUris) {
    try {
      new URL(uri);
    } catch {
      return Response.json(
        {
          error: "invalid_client_metadata",
          error_description: `Invalid redirect_uri: ${uri}`,
        },
        { status: 400, headers: CORS_HEADERS },
      );
    }
  }

  const clientName = (body.client_name as string) || null;
  const grantTypes = (body.grant_types as string[]) || ["authorization_code"];
  const responseTypes = (body.response_types as string[]) || ["code"];
  const tokenEndpointAuthMethod =
    (body.token_endpoint_auth_method as string) || "none";
  const scope = (body.scope as string) || "";

  // Generate a unique client_id
  const clientId = randomBytes(16).toString("hex");
  const now = new Date().toISOString();

  const db = createServerClient();
  const { error: insertError } = await db.from("oauth_clients").insert({
    client_id: clientId,
    client_id_issued_at: now,
    client_name: clientName,
    redirect_uris: redirectUris,
    grant_types: grantTypes,
    response_types: responseTypes,
    token_endpoint_auth_method: tokenEndpointAuthMethod,
    scope,
  });

  if (insertError) {
    console.error("Failed to register OAuth client:", insertError);
    return Response.json(
      {
        error: "server_error",
        error_description: "Failed to register client",
      },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  // RFC 7591 response
  return Response.json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(new Date(now).getTime() / 1000),
      client_name: clientName,
      redirect_uris: redirectUris,
      grant_types: grantTypes,
      response_types: responseTypes,
      token_endpoint_auth_method: tokenEndpointAuthMethod,
      scope,
    },
    { status: 201, headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
