import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/webhook-deliveries/[deliveryId]">,
) {
  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deliveryId } = await ctx.params;
  const db = createServerClient();

  try {
    const { data, error } = await db
      .from("webhook_deliveries")
      .select("*")
      .eq("company_id", userCompany.companyId)
      .eq("id", deliveryId)
      .single();

    if (error && error.code === "PGRST116") {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    if (error) throw error;

    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
