import { redirect } from "next/navigation";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";
import { createServerClient } from "@/adapters/supabase/client";
import type { CompanyId } from "@/core/types";

export const dynamic = "force-dynamic";

function generateSlug(email: string): string {
  const local = email.split("@")[0] ?? "user";
  const base = local.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

export default async function OnboardingPage() {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const db = createServerClient();
  const { data: membership } = await db
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membership) {
    redirect("/api-keys");
  }

  // Auto-create workspace — no UI step needed
  const db2 = createServerClient();
  const email = user.email ?? "user@threadzy.ai";
  const name = email.split("@")[0] ?? "My Workspace";
  const slug = generateSlug(email);

  const { data: company, error: companyError } = await db2
    .from("companies")
    .insert({ name, slug })
    .select("id")
    .single();

  if (companyError) throw companyError;

  // Guard against race condition (concurrent tabs/redirects):
  // Re-check membership before inserting — if another request already
  // created a workspace, clean up the orphan company and redirect.
  const { data: raceCheck } = await db2
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (raceCheck) {
    await db2.from("companies").delete().eq("id", company.id);
    redirect("/api-keys");
  }

  const { error: memberError } = await db2
    .from("company_members")
    .insert({
      company_id: company.id as CompanyId,
      user_id: user.id,
      role: "owner",
    });

  if (memberError) {
    // Another concurrent request won — clean up orphan company
    await db2.from("companies").delete().eq("id", company.id);
    redirect("/api-keys");
  }

  redirect("/api-keys");
}
