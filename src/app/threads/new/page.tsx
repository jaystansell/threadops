import { redirect } from "next/navigation";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { NewThreadForm } from "@/app/_components/new-thread-form";
import type { CompanyId } from "@/core/types";

export const dynamic = "force-dynamic";

export default async function NewThreadPage() {
  const userCompany = await getUserCompany();
  if (!userCompany) redirect("/onboarding");

  const db = createServerClient();
  const apiKeyRepo = createApiKeyRepo(db);
  const allKeys = await apiKeyRepo.listByCompany(userCompany.companyId as CompanyId);
  const activeAgents = allKeys
    .filter((k) => !k.revoked_at)
    .map((k) => ({ id: k.id, label: k.label }));

  return (
    <div className="max-w-xl space-y-4">
      <h2 className="text-xl font-bold">New Thread</h2>
      <NewThreadForm companyId={userCompany.companyId} agents={activeAgents} />
    </div>
  );
}
