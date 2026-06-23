import { redirect } from "next/navigation";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { createServerClient } from "@/adapters/supabase/client";
import type { ApiKey } from "@/core/types";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { SavedPromptsClient } from "../_components/saved-prompts-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Saved Prompts" };

interface SavedPrompt {
  id: string;
  user_id: string;
  title: string;
  body: string;
  agent_scope: { all: true } | { api_key_ids: string[] };
  created_at: string;
  updated_at: string;
}

export default async function PromptsPage() {
  const userCompany = await getUserCompany();
  if (!userCompany) redirect("/onboarding");

  const db = createServerClient();
  const apiKeyRepo = createApiKeyRepo(db);
  const keys: ApiKey[] = await apiKeyRepo.listByUser(
    userCompany.companyId,
    userCompany.userId,
  );
  const activeAgents = keys
    .filter((k) => !k.revoked_at)
    .map((k) => ({ id: k.id, label: k.label }));

  const { data: prompts } = await db
    .from("saved_prompts")
    .select("*")
    .eq("user_id", userCompany.userId)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 w-full space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Saved Prompts</h2>
      </div>

      <SavedPromptsClient
        initialPrompts={(prompts ?? []) as SavedPrompt[]}
        agents={activeAgents}
      />
    </div>
  );
}
