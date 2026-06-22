import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/adapters/supabase/client";
import { createWebhookEndpointRepo } from "@/adapters/supabase/webhook-endpoint-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import type { ApiKey, WebhookEndpoint } from "@/core/types";
import { WEBHOOK_EVENT_TYPES } from "@/core/types";
import { EndpointList } from "@/app/_components/endpoint-list";
import { NewEndpointForm } from "@/app/_components/new-endpoint-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Webhook Endpoints" };

export default async function EndpointsPage() {
  const userCompany = await getUserCompany();
  if (!userCompany) redirect("/onboarding");

  const db = createServerClient();
  const repo = createWebhookEndpointRepo(db);

  const [endpoints, keysResult] = await Promise.all([
    repo.listByCompany(userCompany.companyId).catch(() => []),
    db
      .from("api_keys")
      .select("*")
      .eq("company_id", userCompany.companyId)
      .order("label"),
  ]);

  const apiKeys = (keysResult.data ?? []) as ApiKey[];

  // Build agent label map for display
  const agentLabelMap = new Map<string, { label: string; revoked: boolean }>();
  for (const key of apiKeys) {
    agentLabelMap.set(key.id, {
      label: key.label,
      revoked: !!key.revoked_at,
    });
  }

  // Group endpoints by agent
  const grouped = new Map<string | null, WebhookEndpoint[]>();
  for (const ep of endpoints) {
    const key = ep.api_key_id ?? null;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(ep);
  }

  // Sort: active agents first, then by label, legacy last
  const sortedGroups = Array.from(grouped.entries()).sort(([a], [b]) => {
    if (a === null) return 1;
    if (b === null) return -1;
    const aInfo = agentLabelMap.get(a);
    const bInfo = agentLabelMap.get(b);
    if (aInfo && bInfo) {
      if (aInfo.revoked !== bInfo.revoked) return aInfo.revoked ? 1 : -1;
      return aInfo.label.localeCompare(bInfo.label);
    }
    return 0;
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 w-full space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/webhooks"
          className="text-sm text-[var(--primary)] hover:underline"
        >
          &larr; Back to deliveries
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Webhook Endpoints</h2>
      </div>

      <NewEndpointForm eventTypes={WEBHOOK_EVENT_TYPES} />

      {sortedGroups.length === 0 ? (
        <p className="text-[var(--muted-foreground)] text-sm">
          No webhook endpoints configured yet.
        </p>
      ) : (
        <div className="space-y-6">
          {sortedGroups.map(([agentId, eps]) => {
            const info = agentId ? agentLabelMap.get(agentId) : null;
            const groupLabel = info
              ? info.label
              : agentId
                ? "Unknown Agent"
                : "Legacy (no agent)";
            const isRevoked = info?.revoked ?? false;

            return (
              <div key={agentId ?? "legacy"} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider">
                    {groupLabel}
                  </h3>
                  {agentId && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        isRevoked
                          ? "bg-red-900/50 text-red-400"
                          : "bg-green-900 text-green-300"
                      }`}
                    >
                      {isRevoked ? "Revoked" : "Active"}
                    </span>
                  )}
                </div>
                <EndpointList initialEndpoints={eps} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
