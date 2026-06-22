import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import type { CompanyId } from "@/core/types";

export const dynamic = "force-dynamic";

export async function POST(
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
  const ownsKey = keys.some((k) => k.id === keyId);
  if (!ownsKey) {
    return Response.json({ error: "Key not found" }, { status: 404 });
  }

  const { error } = await db
    .from("api_keys")
    .update({ shared_at: new Date().toISOString() })
    .eq("id", keyId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true, shared_at: new Date().toISOString() });
}
