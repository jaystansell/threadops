import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/adapters/supabase/client";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import type { WebhookDelivery } from "@/core/types";
import { FormattedDate } from "@/app/_components/formatted-date";

export const dynamic = "force-dynamic";

export const metadata = { title: "Webhook Deliveries" };

export default async function WebhooksPage(props: {
  searchParams: Promise<{ page?: string }>;
}) {
  const userCompany = await getUserCompany();
  if (!userCompany) redirect("/onboarding");

  const searchParams = await props.searchParams;
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const db = createServerClient();

  const { count } = await db
    .from("webhook_deliveries")
    .select("*", { count: "exact", head: true })
    .eq("company_id", userCompany.companyId);

  const { data } = await db
    .from("webhook_deliveries")
    .select("*")
    .eq("company_id", userCompany.companyId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const deliveries = (data ?? []) as WebhookDelivery[];
  const total = count ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 w-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold font-mono">webhook.log</h2>
          <span className="text-xs text-[var(--muted-foreground)] font-mono">
            {total} {total === 1 ? "entry" : "entries"}
          </span>
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
            No deliveries logged yet.
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
                  href={`/webhooks?page=${page - 1}`}
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
                  href={`/webhooks?page=${page + 1}`}
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
