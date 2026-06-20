import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/adapters/supabase/client";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { NewThreadForm } from "@/app/_components/new-thread-form";
import type { Theme } from "@/core/types";

export const dynamic = "force-dynamic";

export default async function NewThreadPage() {
  const userCompany = await getUserCompany();
  if (!userCompany) redirect("/onboarding");

  const db = createServerClient();
  const { data: themes } = await db
    .from("themes")
    .select("*")
    .eq("company_id", userCompany.companyId)
    .order("name", { ascending: true });

  return (
    <div className="space-y-4">
      <Link
        href="/threads"
        className="text-sm text-[var(--primary)] hover:underline"
      >
        &larr; Back to Threads
      </Link>
      <h2 className="text-xl font-bold">New Thread</h2>
      <NewThreadForm
        themes={(themes ?? []) as Theme[]}
        companyId={userCompany.companyId}
      />
    </div>
  );
}
