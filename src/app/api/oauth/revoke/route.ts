import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { hashKey } from "@/core/rules/api-key";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * POST /api/oauth/revoke
 *
 * RFC 7009 Token Revocation.
 * Accepts a token and revokes it. Returns 200 even if the token
 * is invalid or already revoked (per spec).
 */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  let token: string | null = null;

  if (contentType.includes("application/json")) {
    try {
      const body = await req.json();
      token = body.token || null;
    } catch {
      // invalid JSON
    }
  } else {
    const body = await req.text();
    const params = new URLSearchParams(body);
    token = params.get("token");
  }

  if (!token) {
    return Response.json(
      { error: "invalid_request", error_description: "Missing token parameter" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const tokenHash = await hashKey(token);
  const db = createServerClient();

  if (token.startsWith("to_at_")) {
    await db
      .from("oauth_access_tokens")
      .delete()
      .eq("token_hash", tokenHash);
  } else if (token.startsWith("to_rt_")) {
    await db
      .from("oauth_refresh_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", tokenHash);
  }

  // Per RFC 7009, always return 200 regardless of whether the token existed
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
