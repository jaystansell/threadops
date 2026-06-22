import { redirect } from "next/navigation";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import type { ApiKey } from "@/core/types";
import { CreateApiKeyForm } from "../_components/create-api-key-form";
import { ApiKeyList } from "../_components/api-key-list";
import { SavingsDashboard } from "../_components/savings-dashboard";

export const dynamic = "force-dynamic";

export const metadata = { title: "API Keys" };

export default async function ApiKeysPage() {
  const userCompany = await getUserCompany();
  if (!userCompany) redirect("/onboarding");

  const db = createServerClient();
  const apiKeyRepo = createApiKeyRepo(db);
  const keys: ApiKey[] = await apiKeyRepo.listByUser(
    userCompany.companyId,
    userCompany.userId,
  );

  const hasKeys = keys.some((k) => !k.revoked_at);

  // Fetch skills and webhook status for all active keys
  const activeKeyIds = keys.filter((k) => !k.revoked_at).map((k) => k.id);
  const skillsMap: Record<string, string[]> = {};
  const webhookStatusMap: Record<string, boolean> = {};
  if (activeKeyIds.length > 0) {
    const [skillResult, webhookResult] = await Promise.all([
      db
        .from("agent_skills")
        .select("api_key_id, skill_name")
        .in("api_key_id", activeKeyIds)
        .order("created_at", { ascending: true }),
      db
        .from("webhook_endpoints")
        .select("api_key_id")
        .eq("company_id", userCompany.companyId)
        .eq("active", true),
    ]);
    for (const row of skillResult.data ?? []) {
      const keyId = row.api_key_id as string;
      if (!skillsMap[keyId]) skillsMap[keyId] = [];
      skillsMap[keyId].push(row.skill_name as string);
    }
    const webhookKeyIds = new Set(
      (webhookResult.data ?? [])
        .map((w: { api_key_id: string | null }) => w.api_key_id)
        .filter(Boolean),
    );
    for (const id of activeKeyIds) {
      webhookStatusMap[id] = webhookKeyIds.has(id);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 w-full space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">API Keys</h2>
      </div>

      {!hasKeys && (
        <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4 space-y-2">
          <p className="text-sm font-medium">Get started</p>
          <p className="text-sm text-[var(--muted-foreground)]">
            Create your API key and give it to your agent along with the prompt
            we provide. If you have more than one agent, create a key for each
            one.
          </p>
        </div>
      )}

      <SavingsDashboard companyId={userCompany.companyId} />

      <CreateApiKeyForm companyId={userCompany.companyId} />

      <ApiKeyList keys={keys} companyId={userCompany.companyId} skillsMap={skillsMap} webhookStatusMap={webhookStatusMap} />
    </div>
  );
}
