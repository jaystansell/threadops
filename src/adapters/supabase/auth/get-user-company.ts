import { createServerClient } from "@/adapters/supabase/client";
import type { CompanyId } from "@/core/types";
import { createAuthServerClient } from "./server";

interface UserCompany {
  userId: string;
  companyId: CompanyId;
}

export async function getUserCompany(): Promise<UserCompany | null> {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const db = createServerClient();
  const { data: membership } = await db
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  return {
    userId: user.id,
    companyId: membership.company_id as CompanyId,
  };
}
