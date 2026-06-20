import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { validateScopes } from "@/core/rules/api-key";
import type { CompanyId } from "@/core/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/companies/[companyId]/api-keys">,
) {
  const { companyId } = await ctx.params;
  const db = createServerClient();
  const apiKeyRepo = createApiKeyRepo(db);

  try {
    const keys = await apiKeyRepo.listByCompany(companyId as CompanyId);
    return Response.json(keys);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/companies/[companyId]/api-keys">,
) {
  const { companyId } = await ctx.params;
  const body = await req.json();

  if (!body.label || typeof body.label !== "string") {
    return Response.json(
      { error: "label is required" },
      { status: 400 },
    );
  }

  const scopes: string[] = body.scopes ?? [];
  if (!validateScopes(scopes)) {
    return Response.json(
      { error: "Invalid scopes provided" },
      { status: 400 },
    );
  }

  const db = createServerClient();
  const apiKeyRepo = createApiKeyRepo(db);

  try {
    const result = await apiKeyRepo.create({
      company_id: companyId as CompanyId,
      label: body.label,
      scopes,
    });

    return Response.json(
      {
        id: result.id,
        plaintext_key: result.plaintext_key,
        key_prefix: result.key_prefix,
        message:
          "Store this key securely. It will not be shown again.",
      },
      { status: 201 },
    );
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
