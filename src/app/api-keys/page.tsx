import { redirect } from "next/navigation";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import type { ApiKey } from "@/core/types";
import { CreateApiKeyForm } from "../_components/create-api-key-form";
import { ApiKeyList } from "../_components/api-key-list";

export const dynamic = "force-dynamic";

export const metadata = { title: "API Keys" };

export default async function ApiKeysPage() {
  const userCompany = await getUserCompany();
  if (!userCompany) redirect("/onboarding");

  const db = createServerClient();
  const apiKeyRepo = createApiKeyRepo(db);
  const keys: ApiKey[] = await apiKeyRepo.listByCompany(userCompany.companyId);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 w-full space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">API Keys</h2>
      </div>

      <CreateApiKeyForm companyId={userCompany.companyId} />

      <ApiKeyList keys={keys} companyId={userCompany.companyId} />
    </div>
  );
}
