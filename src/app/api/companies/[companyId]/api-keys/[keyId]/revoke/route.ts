import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import type { ApiKeyId, CompanyId } from "@/core/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  _req: NextRequest,
  ctx: RouteContext<"/api/companies/[companyId]/api-keys/[keyId]/revoke">,
) {
  const { companyId, keyId } = await ctx.params;
  const db = createServerClient();
  const apiKeyRepo = createApiKeyRepo(db);

  try {
    await apiKeyRepo.revoke(companyId as CompanyId, keyId as ApiKeyId);
    return Response.json({ success: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
