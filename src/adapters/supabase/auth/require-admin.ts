import { createServerClient } from "@/adapters/supabase/client";
import type { CompanyId, CompanyMemberRole } from "@/core/types";
import { createAuthServerClient } from "./server";

const ADMIN_ROLES: CompanyMemberRole[] = ["owner", "admin"];

interface AdminUser {
  userId: string;
  companyId: CompanyId;
  role: CompanyMemberRole;
}

type AdminCheckResult =
  | { status: "ok"; user: AdminUser }
  | { status: "unauthenticated" }
  | { status: "forbidden" };

/**
 * Returns the authenticated user's company membership if they have an
 * admin-level role (owner or admin). Returns a discriminated result so
 * callers can distinguish unauthenticated (401) from forbidden (403).
 */
export async function getAdminUser(): Promise<AdminCheckResult> {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: "unauthenticated" };

  const db = createServerClient();
  const { data: memberships } = await db
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", user.id)
    .order("role" as string, { ascending: true });

  if (!memberships || memberships.length === 0) {
    return { status: "forbidden" };
  }

  // Pick the highest-privilege membership (owner > admin > member).
  // Role column values sort alphabetically: admin < member < owner,
  // so we explicitly find the best role.
  const best = memberships.find((m) =>
    ADMIN_ROLES.includes(m.role as CompanyMemberRole),
  );

  if (!best) return { status: "forbidden" };

  return {
    status: "ok",
    user: {
      userId: user.id,
      companyId: best.company_id as CompanyId,
      role: best.role as CompanyMemberRole,
    },
  };
}

/**
 * Check if a given user ID has admin-level access. Useful in the layout
 * where the user object is already available.
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const db = createServerClient();
  const { data: memberships } = await db
    .from("company_members")
    .select("role")
    .eq("user_id", userId);

  if (!memberships || memberships.length === 0) return false;
  return memberships.some((m) =>
    ADMIN_ROLES.includes(m.role as CompanyMemberRole),
  );
}
