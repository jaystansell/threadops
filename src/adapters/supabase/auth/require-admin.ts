import { createServerClient } from "@/adapters/supabase/client";
import type { CompanyId, CompanyMemberRole } from "@/core/types";
import { createAuthServerClient } from "./server";

const ADMIN_ROLES: CompanyMemberRole[] = ["owner", "admin"];

interface AdminUser {
  userId: string;
  companyId: CompanyId;
  role: CompanyMemberRole;
}

/**
 * Returns the authenticated user's company membership if they have an
 * admin-level role (owner or admin). Returns null otherwise.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const db = createServerClient();
  const { data: membership } = await db
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const role = membership.role as CompanyMemberRole;
  if (!ADMIN_ROLES.includes(role)) return null;

  return {
    userId: user.id,
    companyId: membership.company_id as CompanyId,
    role,
  };
}

/**
 * Check if a given user ID has admin-level access. Useful in the layout
 * where the user object is already available.
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const db = createServerClient();
  const { data: membership } = await db
    .from("company_members")
    .select("role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!membership) return false;
  return ADMIN_ROLES.includes(membership.role as CompanyMemberRole);
}
