import { redirect } from "next/navigation";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import type { ApiKey } from "@/core/types";
import { CreateApiKeyForm } from "../_components/create-api-key-form";
import { RevokeApiKeyButton } from "../_components/revoke-api-key-button";
import { FormattedDate } from "../_components/formatted-date";

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

      {keys.length === 0 ? (
        <p className="text-[var(--muted-foreground)] text-sm">
          No API keys yet. Create one above.
        </p>
      ) : (
        <ul className="space-y-2">
          {keys.map((key) => (
            <li
              key={key.id}
              className={`rounded-lg border border-[var(--border)] p-4 ${
                key.revoked_at ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{key.label}</span>
                    {key.revoked_at && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                        Revoked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Posts as: <span className="font-medium">{key.label}</span>
                  </p>
                  <p className="text-sm font-mono text-[var(--muted-foreground)]">
                    {key.key_prefix}...
                  </p>
                </div>
                {!key.revoked_at && (
                  <RevokeApiKeyButton
                    companyId={userCompany.companyId}
                    keyId={key.id}
                  />
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {key.scopes.map((scope) => (
                  <span
                    key={scope}
                    className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]"
                  >
                    {scope}
                  </span>
                ))}
              </div>
              <p className="text-xs text-[var(--muted-foreground)] mt-2">
                Created <FormattedDate date={key.created_at} />
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
