import { redirect } from "next/navigation";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";
import { createServerClient } from "@/adapters/supabase/client";
import type { CompanyId } from "@/core/types";

export const dynamic = "force-dynamic";

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
    redirect("/threads");
  }

  async function joinDemoCompany() {
    "use server";

    const authClient = await createAuthServerClient();
    const {
      data: { user: currentUser },
    } = await authClient.auth.getUser();
    if (!currentUser) redirect("/login");

    const adminDb = createServerClient();

    const { data: company } = await adminDb
      .from("companies")
      .select("id")
      .limit(1)
      .single();

    if (!company) {
      throw new Error("No company found. Please contact an administrator.");
    }

    const { error } = await adminDb.from("company_members").insert({
      company_id: company.id as CompanyId,
      user_id: currentUser.id,
      role: "member",
    });

    if (error) throw error;

    redirect("/threads");
  }

  return (
    <div className="max-w-sm mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold">Welcome to ThreadOps</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Your account is not yet associated with a company. Join the demo
          company to get started.
        </p>
      </div>

      <form action={joinDemoCompany}>
        <button
          type="submit"
          className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
        >
          Join Demo Company
        </button>
      </form>
    </div>
  );
}
