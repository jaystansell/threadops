import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
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
    await apiKeyRepo.revoke(companyId as CompanyId, keyId as ApiKeyId);

    // Deactivate all webhook endpoints tied to this key
    await db
      .from("webhook_endpoints")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("api_key_id", keyId)
      .eq("active", true);

    return Response.json({ success: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
