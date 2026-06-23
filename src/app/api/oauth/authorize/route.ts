import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import type { CompanyId, ApiKeyId } from "@/core/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/oauth/authorize
 *
 * Called by the consent form after the user approves.
 * Generates an authorization code and redirects to the client's redirect_uri.
 */
export async function POST(req: NextRequest) {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const {
    client_id,
    redirect_uri,
    scope,
    state,
    code_challenge,
    code_challenge_method,
    api_key_id,
  } = body;

  if (!client_id || !redirect_uri || !code_challenge || !api_key_id) {
    return Response.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  if (code_challenge_method && code_challenge_method !== "S256") {
    return Response.json(
      { error: "Only S256 code_challenge_method is supported" },
      { status: 400 },
    );
  }

  const db = createServerClient();

  // Validate registered client and redirect_uri
  const { data: oauthClient } = await db
    .from("oauth_clients")
    .select("redirect_uris")
    .eq("client_id", client_id)
    .maybeSingle();

  if (!oauthClient) {
    return Response.json(
      { error: "invalid_client", error_description: "Unknown client_id" },
      { status: 400 },
    );
  }

  const registeredUris = oauthClient.redirect_uris as string[];
  if (!registeredUris.includes(redirect_uri)) {
    return Response.json(
      {
        error: "invalid_request",
        error_description: "redirect_uri does not match registered URIs",
      },
      { status: 400 },
    );
  }

  // Verify the user owns this API key
  const { data: membership } = await db
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return Response.json({ error: "No company membership" }, { status: 403 });
  }

  const apiKeyRepo = createApiKeyRepo(db);
  const keys = await apiKeyRepo.listByCompany(
    membership.company_id as CompanyId,
  );
  const selectedKey = keys.find((k) => k.id === api_key_id && !k.revoked_at);

  if (!selectedKey) {
    return Response.json(
      { error: "API key not found or revoked" },
      { status: 400 },
    );
  }

  // Generate authorization code
  const code = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const { error: insertError } = await db
    .from("oauth_authorization_codes")
    .insert({
      code,
      client_id,
      redirect_uri,
      code_challenge,
      code_challenge_method: code_challenge_method || "S256",
      api_key_id: api_key_id as ApiKeyId,
      scope: scope || "",
      user_id: user.id,
      company_id: membership.company_id,
      expires_at: expiresAt.toISOString(),
    });

  if (insertError) {
    console.error("Failed to store authorization code:", insertError);
    return Response.json(
      { error: "Failed to create authorization code" },
      { status: 500 },
    );
  }

  // Build redirect URL
  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set("code", code);
  if (state) {
    redirectUrl.searchParams.set("state", state);
  }

  return NextResponse.json({ redirect_uri: redirectUrl.toString() });
}
