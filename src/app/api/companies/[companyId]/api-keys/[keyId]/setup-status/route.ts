import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import type { CompanyId } from "@/core/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ companyId: string; keyId: string }> },
) {
  const { companyId, keyId } = await ctx.params;

  const userCompany = await getUserCompany();
  if (!userCompany || userCompany.companyId !== companyId) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const db = createServerClient();
  const apiKeyRepo = createApiKeyRepo(db);

  const keys = await apiKeyRepo.listByUser(
    companyId as CompanyId,
    userCompany.userId,
  );
  const key = keys.find((k) => k.id === keyId);
  if (!key) {
    return Response.json({ error: "Key not found" }, { status: 404 });
  }

  const [webhookResult, skillsResult] = await Promise.all([
    db
      .from("webhook_endpoints")
      .select("id")
      .eq("company_id", companyId)
      .eq("api_key_id", keyId)
      .eq("active", true)
      .limit(1),
    db
      .from("agent_skills")
      .select("skill_name")
      .eq("api_key_id", keyId)
      .limit(1),
  ]);

  return Response.json({
    has_webhook: (webhookResult.data ?? []).length > 0,
    has_skills: (skillsResult.data ?? []).length > 0,
  });
}
