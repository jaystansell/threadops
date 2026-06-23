import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { dispatchRevokedWebhook } from "@/adapters/supabase/revoked-webhook";
import type { ApiKeyId, CompanyId } from "@/core/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  _req: NextRequest,
  ctx: RouteContext<"/api/companies/[companyId]/api-keys/[keyId]/revoke">,
) {
  const { companyId, keyId } = await ctx.params;

  const userCompany = await getUserCompany();
  if (!userCompany || userCompany.companyId !== companyId) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const db = createServerClient();
  const apiKeyRepo = createApiKeyRepo(db);

  // Verify the key belongs to this user
  const keys = await apiKeyRepo.listByUser(
    companyId as CompanyId,
    userCompany.userId,
  );
  const ownsKey = keys.some((k) => k.id === keyId);
  if (!ownsKey) {
    return Response.json({ error: "Key not found" }, { status: 404 });
  }

  try {
    // Gather context BEFORE revoking so we can include it in the farewell webhook
    const { data: agentThreads } = await db
      .from("threads")
      .select("id, title, status")
      .eq("company_id", companyId)
      .eq("agent_api_key_id", keyId);

    const { data: agentEndpoints } = await db
      .from("webhook_endpoints")
      .select("id, url, events, active")
      .eq("company_id", companyId)
      .eq("api_key_id", keyId);

    const keyRecord = keys.find((k) => k.id === keyId);

    // Send agent.revoked webhook BEFORE deactivating endpoints
    await dispatchRevokedWebhook(
      companyId as CompanyId,
      keyId as ApiKeyId,
      keyRecord?.label ?? "Unknown Agent",
      keyRecord?.key_prefix ?? "",
      agentThreads ?? [],
      agentEndpoints ?? [],
    );

    await apiKeyRepo.revoke(companyId as CompanyId, keyId as ApiKeyId);

    // Deactivate all webhook endpoints tied to this key
    const { error: deactivateError } = await db
      .from("webhook_endpoints")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("company_id", companyId)
      .eq("api_key_id", keyId)
      .eq("active", true);
    if (deactivateError) throw deactivateError;

    return Response.json({ success: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
