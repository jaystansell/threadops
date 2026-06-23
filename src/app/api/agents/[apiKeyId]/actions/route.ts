import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { resolveApiKey } from "@/adapters/supabase/api-key-auth";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";

export const dynamic = "force-dynamic";

/**
 * POST /api/agents/[apiKeyId]/actions
 * Register a new action that the agent supports.
 *
 * Auth: X-API-Key header (agent self-registration) or session cookie (admin).
 * Body: { name, description?, parameter_schema? }
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ apiKeyId: string }> },
) {
  const { apiKeyId } = await ctx.params;
  const auth = await resolveAuth(req, apiKeyId);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return Response.json(
      { error: "Body must include 'name' as a non-empty string" },
      { status: 400 },
    );
  }

  const name = body.name.trim();
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const parameterSchema =
    body.parameter_schema && typeof body.parameter_schema === "object"
      ? body.parameter_schema
      : {};

  const db = createServerClient();

  // Verify the API key belongs to the resolved company
  const { data: apiKey } = await db
    .from("api_keys")
    .select("id, company_id")
    .eq("id", apiKeyId)
    .is("revoked_at", null)
    .single();

  if (!apiKey) {
    return Response.json({ error: "API key not found" }, { status: 404 });
  }
  if (apiKey.company_id !== auth.companyId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await db
    .from("agent_actions")
    .upsert(
      {
        api_key_id: apiKeyId,
        company_id: auth.companyId,
        name,
        description,
        parameter_schema: parameterSchema,
      },
      { onConflict: "api_key_id,name" },
    )
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}

/**
 * GET /api/agents/[apiKeyId]/actions
 * List all actions declared by this agent.
 *
 * Auth: X-API-Key header or session cookie.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ apiKeyId: string }> },
) {
  const { apiKeyId } = await ctx.params;
  const auth = await resolveAuth(req, apiKeyId);
  if (auth.error) return auth.error;

  const db = createServerClient();

  const { data: apiKey } = await db
    .from("api_keys")
    .select("id, company_id")
    .eq("id", apiKeyId)
    .is("revoked_at", null)
    .single();

  if (!apiKey) {
    return Response.json({ error: "API key not found" }, { status: 404 });
  }
  if (apiKey.company_id !== auth.companyId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await db
    .from("agent_actions")
    .select("id, name, description, parameter_schema, created_at")
    .eq("api_key_id", apiKeyId)
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data ?? []);
}

// ---------------------------------------------------------------------------
// Auth helper: accept either API-key or session-cookie auth
// ---------------------------------------------------------------------------

type AuthResult =
  | { companyId: string; error?: undefined }
  | { error: Response; companyId?: undefined };

async function resolveAuth(
  req: NextRequest,
  apiKeyId: string,
): Promise<AuthResult> {
  // Try API key auth first
  const apiKeyResult = await resolveApiKey(req);
  if (apiKeyResult.kind === "invalid") return { error: apiKeyResult.response };
  if (apiKeyResult.kind === "rate_limited") return { error: apiKeyResult.response };
  if (apiKeyResult.kind === "ok") {
    // Agent can only manage its own actions
    if (apiKeyResult.keyId !== apiKeyId) {
      return {
        error: Response.json(
          { error: "API key does not match the agent in the URL" },
          { status: 403 },
        ),
      };
    }
    return { companyId: apiKeyResult.companyId };
  }

  // Fall back to session cookie auth (admin UI)
  const userCompany = await getUserCompany();
  if (!userCompany) {
    return {
      error: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { companyId: userCompany.companyId };
}
