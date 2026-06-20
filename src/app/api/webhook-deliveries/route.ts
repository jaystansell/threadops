import { createServerClient } from "@/adapters/supabase/client";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 10;
  const offset = (page - 1) * limit;

  const db = createServerClient();

  try {
    const { count } = await db
      .from("webhook_deliveries")
      .select("*", { count: "exact", head: true })
      .eq("company_id", userCompany.companyId);

    const { data, error } = await db
      .from("webhook_deliveries")
      .select("*")
      .eq("company_id", userCompany.companyId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return Response.json({
      deliveries: data,
      total: count ?? 0,
      page,
      pageSize: limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
