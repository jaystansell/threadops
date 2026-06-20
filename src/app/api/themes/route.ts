import { createServerClient } from "@/adapters/supabase/client";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";
import type { CompanyId, Theme } from "@/core/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServerClient();

  const { data: membership } = await db
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return Response.json({ error: "No company membership" }, { status: 403 });
  }

  const { data, error } = await db
    .from("themes")
    .select("*")
    .eq("company_id", membership.company_id as CompanyId)
    .order("name", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data as Theme[]);
}
