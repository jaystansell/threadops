import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { hashKey } from "@/core/rules/api-key";
import { checkRateLimit } from "@/core/rules/rate-limit";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonError(
  error: string,
  errorDescription: string,
  status: number,
): Response {
  return Response.json(
    { error, error_description: errorDescription },
    { status, headers: CORS_HEADERS },
  );
}

export async function POST(req: NextRequest) {
  // Clone the request so we can read the body multiple times
  const bodyText = await req.text();
  const contentType = req.headers.get("content-type") || "";

  // Parse body once
  let grantType: string | null = null;
  let clientSecret: string | null = null;

  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(bodyText);
      grantType = parsed.grant_type || null;
      clientSecret = parsed.client_secret || null;
    } catch {
      return jsonError(
        "invalid_request",
        "Invalid JSON body",
        400,
      );
    }
  } else {
    // form-urlencoded
    const params = new URLSearchParams(bodyText);
    grantType = params.get("grant_type");
    clientSecret = params.get("client_secret");
  }

  // Check HTTP Basic auth as fallback for client_secret
  if (!clientSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Basic ")) {
      try {
        const decoded = atob(authHeader.slice(6));
        const colonIndex = decoded.indexOf(":");
        if (colonIndex !== -1) {
          clientSecret = decoded.slice(colonIndex + 1);
        }
      } catch {
        // Invalid base64, ignore
      }
    }
  }

  // Validate grant_type
  if (grantType !== "client_credentials") {
    return jsonError(
      "unsupported_grant_type",
      "Only client_credentials grant type is supported",
      400,
    );
  }

  // Validate client_secret is present
  if (!clientSecret) {
    return jsonError(
      "invalid_request",
      "Missing client_secret",
      400,
    );
  }

  // Validate the API key against the database
  const db = createServerClient();
  const apiKeyRepo = createApiKeyRepo(db);
  const keyHash = await hashKey(clientSecret);
  const keyRecord = await apiKeyRepo.lookupByHash(keyHash);

  // Rate limit by key hash (prevent brute force)
  const limit = checkRateLimit(`oauth_token:${keyHash}`);
  if (!limit.allowed) {
    return Response.json(
      { error: "rate_limit_exceeded", error_description: "Too many requests" },
      {
        status: 429,
        headers: {
          ...CORS_HEADERS,
          "Retry-After": String(Math.ceil(limit.retryAfterMs! / 1000)),
        },
      },
    );
  }

  if (!keyRecord) {
    return jsonError("invalid_client", "Invalid API key", 401);
  }

  // Touch last used
  await apiKeyRepo.touchLastUsed(keyRecord.id);

  // Return the access token (reuse the API key itself)
  const scopes = keyRecord.scopes?.length
    ? keyRecord.scopes.join(" ")
    : "threads:read threads:write messages:read messages:write";

  return Response.json(
    {
      access_token: clientSecret,
      token_type: "Bearer",
      expires_in: 3600,
      scope: scopes,
    },
    { headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
