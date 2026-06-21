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

  async function createWorkspace() {
    "use server";

    const authClient = await createAuthServerClient();
    const {
      data: { user: currentUser },
    } = await authClient.auth.getUser();
    if (!currentUser) redirect("/login");

    const adminDb = createServerClient();

    const email = currentUser.email ?? "user@threadzy.ai";
    const name = email.split("@")[0] ?? "My Workspace";
    const slug = generateSlug(email);

    const { data: company, error: companyError } = await adminDb
      .from("companies")
      .insert({ name, slug })
      .select("id")
      .single();

    if (companyError) throw companyError;

    const { error: memberError } = await adminDb
      .from("company_members")
      .insert({
        company_id: company.id as CompanyId,
        user_id: currentUser.id,
        role: "owner",
      });

    if (memberError) throw memberError;

    redirect("/api-keys");
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold">Welcome to Threadzy</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Create your workspace to get started. Your agents and threads will be
          private to your account.
        </p>
      </div>

      <form action={createWorkspace}>
        <button
          type="submit"
          className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
        >
          Create My Workspace
        </button>
      </form>
    </div>
  );
}
