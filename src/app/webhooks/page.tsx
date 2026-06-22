import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/adapters/supabase/client";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import type { WebhookDelivery, WebhookEndpoint, ApiKey } from "@/core/types";
import { FormattedDate } from "@/app/_components/formatted-date";

export const dynamic = "force-dynamic";

export const metadata = { title: "Webhook Deliveries" };

interface AgentOverview {
  apiKey: ApiKey;
  endpoints: WebhookEndpoint[];
  activeEndpoints: number;
}

export default async function WebhooksPage(props: {
  searchParams: Promise<{ page?: string; agent?: string }>;
}) {
  const userCompany = await getUserCompany();
  if (!userCompany) redirect("/onboarding");

  const searchParams = await props.searchParams;
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const agentFilter = searchParams.agent ?? null;
  const limit = 50;
  const offset = (page - 1) * limit;

  const db = createServerClient();

  // Fetch agents (API keys) and their webhook endpoints
  const [keysResult, endpointsResult] = await Promise.all([
    db
      .from("api_keys")
      .select("*")
      .eq("company_id", userCompany.companyId)
      .order("label"),
    db
      .from("webhook_endpoints")
      .select("*")
      .eq("company_id", userCompany.companyId)
      .order("created_at", { ascending: false }),
  ]);

  const apiKeys = (keysResult.data ?? []) as ApiKey[];
  const allEndpoints = (endpointsResult.data ?? []) as WebhookEndpoint[];

  // Build agent overview map
  const agentMap = new Map<string, AgentOverview>();
  for (const key of apiKeys) {
    const eps = allEndpoints.filter((ep) => ep.api_key_id === key.id);
    agentMap.set(key.id, {
      apiKey: key,
      endpoints: eps,
      activeEndpoints: eps.filter((ep) => ep.active).length,
    });
  }

  // Legacy endpoints (no agent binding)
  const legacyEndpoints = allEndpoints.filter((ep) => !ep.api_key_id);

  // Build agent overview list sorted: active first, then by label
  const agents = Array.from(agentMap.values()).sort((a, b) => {
    const aActive = !a.apiKey.revoked_at;
    const bActive = !b.apiKey.revoked_at;
    if (aActive !== bActive) return aActive ? -1 : 1;
    return a.apiKey.label.localeCompare(b.apiKey.label);
  });

  // If filtering by agent, get the thread IDs for that agent to filter deliveries
  let threadIdsForAgent: string[] | null = null;
  if (agentFilter) {
    const { data: threads } = await db
      .from("threads")
      .select("id")
      .eq("company_id", userCompany.companyId)
      .eq("agent_api_key_id", agentFilter);
    threadIdsForAgent = (threads ?? []).map((t: { id: string }) => t.id);
  }

  // Fetch deliveries (with optional agent thread filter)
  let countQuery = db
    .from("webhook_deliveries")
    .select("*", { count: "exact", head: true })
    .eq("company_id", userCompany.companyId);

  let dataQuery = db
    .from("webhook_deliveries")
    .select("*")
    .eq("company_id", userCompany.companyId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Apply agent filter via source=outbound + payload thread_id
  if (agentFilter && threadIdsForAgent && threadIdsForAgent.length > 0) {
    countQuery = countQuery.eq("source", "outbound");
    dataQuery = dataQuery.eq("source", "outbound");
  }

  const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);

  let deliveries = (dataResult.data ?? []) as WebhookDelivery[];
  let total = countResult.count ?? 0;

  // Client-side filter for agent thread IDs (PostgREST doesn't support payload->>'thread_id' in())
  if (agentFilter && threadIdsForAgent) {
    if (threadIdsForAgent.length === 0) {
      deliveries = [];
      total = 0;
    } else {
      const threadSet = new Set(threadIdsForAgent);
      deliveries = deliveries.filter((d) => {
        const tid = d.payload?.thread_id as string | undefined;
        return tid && threadSet.has(tid);
      });
      // Approximate count (not exact for filtered results, but good enough for pagination)
      total = deliveries.length < limit ? offset + deliveries.length : total;
    }
  }

  const totalPages = Math.ceil(total / limit);
  const filterLabel = agentFilter
    ? apiKeys.find((k) => k.id === agentFilter)?.label ?? "Unknown"
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 w-full space-y-4">
      {/* Agent Overview */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider font-mono">
          Agents
        </h2>
        {agents.length === 0 && legacyEndpoints.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)] font-mono">
            No agents registered yet.{" "}
            <Link href="/api-keys" className="text-[var(--primary)] hover:underline">
              Create an API key
            </Link>{" "}
            to get started.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {agents.map((ag) => {
              const isActive = !ag.apiKey.revoked_at;
              const isFiltered = agentFilter === ag.apiKey.id;
              return (
                <Link
                  key={ag.apiKey.id}
                  href={isFiltered ? "/webhooks" : `/webhooks?agent=${ag.apiKey.id}`}
                  className={`rounded-lg border p-3 space-y-1.5 transition-colors hover:border-[var(--primary)] ${
                    isFiltered
                      ? "border-[var(--primary)] bg-[var(--primary)]/5"
                      : "border-[var(--border)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold truncate">
                      {ag.apiKey.label}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        isActive
                          ? "bg-green-900 text-green-300"
                          : "bg-red-900/50 text-red-400"
                      }`}
                    >
                      {isActive ? "Active" : "Revoked"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                    <span className="flex items-center gap-1">
                      <WebhookIcon />
                      {ag.activeEndpoints}/{ag.endpoints.length} endpoint{ag.endpoints.length !== 1 ? "s" : ""}
                    </span>
                    {ag.endpoints.length > 0 && ag.activeEndpoints === 0 && (
                      <span className="text-yellow-500">No active endpoints</span>
                    )}
                    {ag.endpoints.length === 0 && (
                      <span className="text-yellow-500">No endpoints</span>
                    )}
                  </div>
                </Link>
              );
            })}
            {legacyEndpoints.length > 0 && (
              <div className="rounded-lg border border-[var(--border)] p-3 space-y-1.5 opacity-60">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[var(--muted-foreground)]">
                    Legacy (no agent)
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                  <span className="flex items-center gap-1">
                    <WebhookIcon />
                    {legacyEndpoints.filter((e) => e.active).length}/{legacyEndpoints.length} endpoint{legacyEndpoints.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delivery Log */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold font-mono">webhook.log</h2>
          <span className="text-xs text-[var(--muted-foreground)] font-mono">
            {total} {total === 1 ? "entry" : "entries"}
          </span>
          {filterLabel && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] font-mono">
              {filterLabel}
              <Link href="/webhooks" className="ml-1 hover:underline">
                ✕
              </Link>
            </span>
          )}
        </div>
        <Link
          href="/webhooks/endpoints"
          className="px-3 py-1.5 text-xs font-medium rounded border border-[var(--border)] hover:border-[var(--primary)] transition-colors font-mono"
        >
          endpoints
        </Link>
      </div>

      {deliveries.length === 0 ? (
        <div className="rounded border border-[var(--border)] bg-[var(--muted)]/30 p-6 text-center">
          <p className="text-sm text-[var(--muted-foreground)] font-mono">
            {agentFilter ? "No deliveries for this agent yet." : "No deliveries logged yet."}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-[var(--border)] bg-[#0a0e14] overflow-hidden">
            <div className="px-3 py-2 border-b border-[var(--border)] flex items-center gap-3 text-[10px] font-mono text-[var(--muted-foreground)] uppercase tracking-wider">
              <span className="w-[140px] shrink-0">timestamp</span>
              <span className="w-[60px] shrink-0 text-center">status</span>
              <span className="w-[150px] shrink-0">event</span>
              <span className="flex-1">payload</span>
            </div>
            <div className="divide-y divide-[var(--border)]/30">
              {deliveries.map((d) => (
                <Link
                  key={d.id}
                  href={`/webhooks/${d.id}`}
                  className="flex items-start gap-3 px-3 py-1.5 hover:bg-white/[0.03] transition-colors text-xs font-mono group"
                >
                  <span className="w-[140px] shrink-0 text-[var(--muted-foreground)] tabular-nums">
                    <FormattedDate date={d.created_at} includeTime />
                  </span>
                  <span className="w-[60px] shrink-0 text-center">
                    <LogStatus status={d.status} />
                  </span>
                  <span className="w-[150px] shrink-0 text-blue-400">
                    {d.event_type}
                  </span>
                  <span className="flex-1 text-[var(--muted-foreground)] truncate group-hover:text-[var(--foreground)] transition-colors">
                    {compactPayload(d.payload)}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-1 font-mono text-xs">
              {page > 1 && (
                <Link
                  href={`/webhooks?page=${page - 1}${agentFilter ? `&agent=${agentFilter}` : ""}`}
                  className="px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
                >
                  prev
                </Link>
              )}
              <span className="text-[var(--muted-foreground)]">
                {page}/{totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/webhooks?page=${page + 1}${agentFilter ? `&agent=${agentFilter}` : ""}`}
                  className="px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
                >
                  next
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LogStatus({ status }: { status: string }) {
  const styles: Record<string, string> = {
    succeeded: "text-green-400",
    failed: "text-red-400",
    pending: "text-yellow-400",
    processing: "text-blue-400",
  };
  const icons: Record<string, string> = {
    succeeded: "\u2713",
    failed: "\u2717",
    pending: "\u25CB",
    processing: "\u25CF",
  };
  return (
    <span className={styles[status] ?? "text-[var(--muted-foreground)]"}>
      {icons[status] ?? "\u25CB"} {status === "succeeded" ? "ok" : status}
    </span>
  );
}

function compactPayload(payload: Record<string, unknown>): string {
  const str = JSON.stringify(payload);
  return str.length > 120 ? str.slice(0, 120) + "\u2026" : str;
}

function WebhookIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2" />
      <path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06" />
      <path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8H12" />
    </svg>
  );
}
