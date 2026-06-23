import { randomBytes } from "crypto";
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

function rateLimitedResponse(retryAfterMs: number): Response {
  return Response.json(
    { error: "rate_limit_exceeded", error_description: "Too many requests" },
    {
      status: 429,
      headers: {
        ...CORS_HEADERS,
        "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
      },
    },
  );
}

// ---- body parsing ----

interface ParsedBody {
  grantType: string | null;
  clientSecret: string | null;
  code: string | null;
  redirectUri: string | null;
  codeVerifier: string | null;
}

function parseBody(bodyText: string, contentType: string): ParsedBody | null {
  if (contentType.includes("application/json")) {
    try {
      const p = JSON.parse(bodyText);
      return {
        grantType: p.grant_type || null,
        clientSecret: p.client_secret || null,
        code: p.code || null,
        redirectUri: p.redirect_uri || null,
        codeVerifier: p.code_verifier || null,
      };
    } catch {
      return null;
    }
  }
  const params = new URLSearchParams(bodyText);
  return {
    grantType: params.get("grant_type"),
    clientSecret: params.get("client_secret"),
    code: params.get("code"),
    redirectUri: params.get("redirect_uri"),
    codeVerifier: params.get("code_verifier"),
  };
}

// ---- PKCE helpers ----

async function sha256Base64Url(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---- grant handlers ----

async function handleClientCredentials(
  clientSecret: string | null,
  authHeader: string | null,
): Promise<Response> {
  let secret = clientSecret;
  if (!secret && authHeader?.startsWith("Basic ")) {
    try {
      const decoded = atob(authHeader.slice(6));
      const colonIndex = decoded.indexOf(":");
      if (colonIndex !== -1) {
        secret = decoded.slice(colonIndex + 1);
      }
    } catch {
      // Invalid base64
    }
  }

  if (!secret) {
    return jsonError("invalid_request", "Missing client_secret", 400);
  }

  const db = createServerClient();
  const apiKeyRepo = createApiKeyRepo(db);
  const keyHash = await hashKey(secret);

  const limit = checkRateLimit(`oauth_token:${keyHash}`);
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterMs!);

  const keyRecord = await apiKeyRepo.lookupByHash(keyHash);
  if (!keyRecord) {
    return jsonError("invalid_client", "Invalid API key", 401);
  }

  await apiKeyRepo.touchLastUsed(keyRecord.id);

  const scopes = keyRecord.scopes?.length
    ? keyRecord.scopes.join(" ")
    : "threads:read threads:write messages:read messages:write";

  return Response.json(
    {
      access_token: secret,
      token_type: "Bearer",
      expires_in: 3600,
      scope: scopes,
    },
    { headers: CORS_HEADERS },
  );
}

async function handleAuthorizationCode(
  code: string | null,
  redirectUri: string | null,
  codeVerifier: string | null,
): Promise<Response> {
  if (!code) return jsonError("invalid_request", "Missing code", 400);
  if (!codeVerifier) {
    return jsonError("invalid_request", "Missing code_verifier", 400);
  }

  const limit = checkRateLimit(`oauth_code:${code}`);
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterMs!);

  const db = createServerClient();

  // Look up the authorization code
  const { data: codeRecord, error: lookupError } = await db
    .from("oauth_authorization_codes")
    .select("*")
    .eq("code", code)
    .single();

  if (lookupError || !codeRecord) {
    return jsonError("invalid_grant", "Invalid authorization code", 400);
  }

  if (new Date(codeRecord.expires_at) < new Date()) {
    return jsonError("invalid_grant", "Authorization code expired", 400);
  }

  if (codeRecord.used_at) {
    return jsonError("invalid_grant", "Authorization code already used", 400);
  }

  if (redirectUri && redirectUri !== codeRecord.redirect_uri) {
    return jsonError("invalid_grant", "redirect_uri mismatch", 400);
  }

  // PKCE verification
  const computedChallenge = await sha256Base64Url(codeVerifier);
  if (computedChallenge !== codeRecord.code_challenge) {
    return jsonError("invalid_grant", "PKCE verification failed", 400);
  }

  // Mark code as used (one-time use)
  await db
    .from("oauth_authorization_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code", code);

  // Generate an opaque access token and store its hash.
  // The MCP auth middleware resolves this token via oauth_access_tokens.
  const accessToken = `to_at_${randomBytes(32).toString("hex")}`;
  const tokenHash = await hashKey(accessToken);
  const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour

  const { error: insertError } = await db
    .from("oauth_access_tokens")
    .insert({
      token_hash: tokenHash,
      api_key_id: codeRecord.api_key_id,
      company_id: codeRecord.company_id,
      user_id: codeRecord.user_id,
      scope: codeRecord.scope,
      expires_at: expiresAt.toISOString(),
    });

  if (insertError) {
    console.error("Failed to store access token:", insertError);
    return jsonError("server_error", "Failed to issue access token", 500);
  }

  // Read scopes from the linked API key
  const { data: keyData } = await db
    .from("api_keys")
    .select("scopes")
    .eq("id", codeRecord.api_key_id)
    .single();

  const keyScopes = (keyData?.scopes as string[] | null)?.length
    ? (keyData!.scopes as string[]).join(" ")
    : "threads:read threads:write messages:read messages:write";

  return Response.json(
    {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      scope: codeRecord.scope || keyScopes,
    },
    { headers: CORS_HEADERS },
  );
}

// ---- main handler ----

export async function POST(req: NextRequest) {
  const bodyText = await req.text();
  const contentType = req.headers.get("content-type") || "";

  const parsed = parseBody(bodyText, contentType);
  if (!parsed) {
    return jsonError("invalid_request", "Invalid request body", 400);
  }

  switch (parsed.grantType) {
    case "client_credentials":
      return handleClientCredentials(
        parsed.clientSecret,
        req.headers.get("authorization"),
      );

    case "authorization_code":
      return handleAuthorizationCode(
        parsed.code,
        parsed.redirectUri,
        parsed.codeVerifier,
      );

    default:
      return jsonError(
        "unsupported_grant_type",
        "Supported grant types: client_credentials, authorization_code",
        400,
      );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
