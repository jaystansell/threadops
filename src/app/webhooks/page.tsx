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
  const limit = 10;
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
    <div className="max-w-3xl mx-auto px-4 py-6 w-full space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold">Webhook Deliveries</h2>
        <Link
          href="/webhooks/endpoints"
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity w-fit"
        >
          Manage Endpoints
        </Link>
      </div>

      {deliveries.length === 0 ? (
        <p className="text-[var(--muted-foreground)] text-sm">
          No webhook deliveries yet.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {deliveries.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/webhooks/${d.id}`}
                  className="block rounded-lg border border-[var(--border)] p-3 sm:p-4 hover:border-[var(--primary)] transition-colors"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-mono text-sm truncate max-w-full sm:max-w-[200px]">
                      {d.idempotency_key}
                    </span>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={d.status} />
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {d.attempts} attempt{d.attempts !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
                      {d.event_type}
                    </span>
                    <span className="text-xs text-[var(--muted-foreground)] hidden sm:inline">
                      {truncatePayload(d.payload)}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    <FormattedDate date={d.created_at} includeTime />
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              {page > 1 && (
                <Link
                  href={`/webhooks?page=${page - 1}`}
                  className="px-3 py-1 text-sm rounded border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
                >
                  Previous
                </Link>
              )}
              <span className="text-sm text-[var(--muted-foreground)]">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/webhooks?page=${page + 1}`}
                  className="px-3 py-1 text-sm rounded border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
                >
                  Next
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    succeeded: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    processing: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full ${colors[status] ?? "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}
    >
      {status}
    </span>
  );
}

function truncatePayload(payload: Record<string, unknown>): string {
  const str = JSON.stringify(payload);
  return str.length > 80 ? str.slice(0, 80) + "…" : str;
}
