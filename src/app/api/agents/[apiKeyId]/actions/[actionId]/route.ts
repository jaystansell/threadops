import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { resolveApiKey } from "@/adapters/supabase/api-key-auth";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/agents/[apiKeyId]/actions/[actionId]
 * Remove a declared action.
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ apiKeyId: string; actionId: string }> },
) {
  const { apiKeyId, actionId } = await ctx.params;
  const auth = await resolveAuth(req, apiKeyId);
  if (auth.error) return auth.error;

  const db = createServerClient();

  // Verify ownership
  const { data: action } = await db
    .from("agent_actions")
    .select("id, api_key_id, company_id")
    .eq("id", actionId)
    .eq("api_key_id", apiKeyId)
    .single();

  if (!action) {
    return Response.json({ error: "Action not found" }, { status: 404 });
  }
  if (action.company_id !== auth.companyId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await db
    .from("agent_actions")
    .delete()
    .eq("id", actionId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, deleted: actionId });
}

// ---------------------------------------------------------------------------
// Auth helper (same pattern as parent route)
// ---------------------------------------------------------------------------

type AuthResult =
  | { companyId: string; error?: undefined }
  | { error: Response; companyId?: undefined };

async function resolveAuth(
  req: NextRequest,
  apiKeyId: string,
): Promise<AuthResult> {
  const apiKeyResult = await resolveApiKey(req);
  if (apiKeyResult.kind === "invalid") return { error: apiKeyResult.response };
  if (apiKeyResult.kind === "rate_limited") return { error: apiKeyResult.response };
  if (apiKeyResult.kind === "ok") {
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

  const userCompany = await getUserCompany();
  if (!userCompany) {
    return {
      error: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { companyId: userCompany.companyId };
}
