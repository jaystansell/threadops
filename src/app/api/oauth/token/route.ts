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
  "Access-Control-Expose-Headers": "WWW-Authenticate",
};

// RFC 6749 Section 5.1: token responses MUST include these headers
const TOKEN_RESPONSE_HEADERS = {
  ...CORS_HEADERS,
  "Cache-Control": "no-store",
  "Pragma": "no-cache",
};

const ACCESS_TOKEN_TTL = 3600; // 1 hour
const REFRESH_TOKEN_TTL = 30 * 24 * 3600; // 30 days

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

function generateToken(prefix: string): string {
  return `${prefix}${randomBytes(32).toString("hex")}`;
}

// ---- body parsing ----

interface ParsedBody {
  grantType: string | null;
  clientId: string | null;
  clientSecret: string | null;
  code: string | null;
  redirectUri: string | null;
  codeVerifier: string | null;
  refreshToken: string | null;
}

function parseBody(bodyText: string, contentType: string): ParsedBody | null {
  if (contentType.includes("application/json")) {
    try {
      const p = JSON.parse(bodyText);
      return {
        grantType: p.grant_type || null,
        clientId: p.client_id || null,
        clientSecret: p.client_secret || null,
        code: p.code || null,
        redirectUri: p.redirect_uri || null,
        codeVerifier: p.code_verifier || null,
        refreshToken: p.refresh_token || null,
      };
    } catch {
      return null;
    }
  }
  const params = new URLSearchParams(bodyText);
  return {
    grantType: params.get("grant_type"),
    clientId: params.get("client_id"),
    clientSecret: params.get("client_secret"),
    code: params.get("code"),
    redirectUri: params.get("redirect_uri"),
    codeVerifier: params.get("code_verifier"),
    refreshToken: params.get("refresh_token"),
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

// ---- token helpers ----

async function issueTokenPair(
  db: ReturnType<typeof createServerClient>,
  params: {
    apiKeyId: string;
    companyId: string;
    userId: string;
    clientId: string;
    scope: string;
  },
): Promise<{ accessToken: string; refreshToken: string } | Response> {
  const accessToken = generateToken("to_at_");
  const refreshToken = generateToken("to_rt_");
  const accessHash = await hashKey(accessToken);
  const refreshHash = await hashKey(refreshToken);
  const accessExpires = new Date(Date.now() + ACCESS_TOKEN_TTL * 1000);
  const refreshExpires = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000);

  const { error: atErr } = await db.from("oauth_access_tokens").insert({
    token_hash: accessHash,
    api_key_id: params.apiKeyId,
    company_id: params.companyId,
    user_id: params.userId,
    scope: params.scope,
    expires_at: accessExpires.toISOString(),
  });

  if (atErr) {
    console.error("Failed to store access token:", atErr);
    return jsonError("server_error", "Failed to issue access token", 500);
  }

  const { error: rtErr } = await db.from("oauth_refresh_tokens").insert({
    token_hash: refreshHash,
    api_key_id: params.apiKeyId,
    company_id: params.companyId,
    user_id: params.userId,
    client_id: params.clientId,
    scope: params.scope,
    expires_at: refreshExpires.toISOString(),
  });

  if (rtErr) {
    console.error("Failed to store refresh token:", rtErr);
    return jsonError("server_error", "Failed to issue refresh token", 500);
  }

  return { accessToken, refreshToken };
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
      expires_in: ACCESS_TOKEN_TTL,
      scope: scopes,
    },
    { headers: TOKEN_RESPONSE_HEADERS },
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

  const computedChallenge = await sha256Base64Url(codeVerifier);
  if (computedChallenge !== codeRecord.code_challenge) {
    return jsonError("invalid_grant", "PKCE verification failed", 400);
  }

  await db
    .from("oauth_authorization_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code", code);

  const scope =
    codeRecord.scope ||
    "threads:read threads:write messages:read messages:write";

  const result = await issueTokenPair(db, {
    apiKeyId: codeRecord.api_key_id,
    companyId: codeRecord.company_id,
    userId: codeRecord.user_id,
    clientId: codeRecord.client_id,
    scope,
  });

  if (result instanceof Response) return result;

  return Response.json(
    {
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL,
      scope,
    },
    { headers: TOKEN_RESPONSE_HEADERS },
  );
}

async function handleRefreshToken(
  refreshTokenValue: string | null,
): Promise<Response> {
  if (!refreshTokenValue) {
    return jsonError("invalid_request", "Missing refresh_token", 400);
  }

  const tokenHash = await hashKey(refreshTokenValue);

  const limit = checkRateLimit(`oauth_refresh:${tokenHash}`);
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterMs!);

  const db = createServerClient();

  const { data: rtRecord, error: rtError } = await db
    .from("oauth_refresh_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .single();

  if (rtError || !rtRecord) {
    return jsonError("invalid_grant", "Invalid refresh token", 400);
  }

  if (rtRecord.revoked_at) {
    return jsonError("invalid_grant", "Refresh token has been revoked", 400);
  }

  if (new Date(rtRecord.expires_at) < new Date()) {
    return jsonError("invalid_grant", "Refresh token expired", 400);
  }

  // Revoke the old refresh token (rotation)
  await db
    .from("oauth_refresh_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", rtRecord.id);

  const result = await issueTokenPair(db, {
    apiKeyId: rtRecord.api_key_id,
    companyId: rtRecord.company_id,
    userId: rtRecord.user_id,
    clientId: rtRecord.client_id,
    scope: rtRecord.scope,
  });

  if (result instanceof Response) return result;

  return Response.json(
    {
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL,
      scope: rtRecord.scope,
    },
    { headers: TOKEN_RESPONSE_HEADERS },
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

    case "refresh_token":
      return handleRefreshToken(parsed.refreshToken);

    default:
      return jsonError(
        "unsupported_grant_type",
        "Supported grant types: authorization_code, client_credentials, refresh_token",
        400,
      );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
