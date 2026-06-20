import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createServerClient } from "@/adapters/supabase/client";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import type { WebhookDelivery } from "@/core/types";

export const dynamic = "force-dynamic";

export default async function DeliveryDetailPage(
  props: PageProps<"/webhooks/[deliveryId]">,
) {
  const userCompany = await getUserCompany();
  if (!userCompany) redirect("/onboarding");

  const { deliveryId } = await props.params;

  const db = createServerClient();
  const { data, error } = await db
    .from("webhook_deliveries")
    .select("*")
    .eq("company_id", userCompany.companyId)
    .eq("id", deliveryId)
    .single();

  if (error && error.code === "PGRST116") notFound();
  if (error) throw error;

  const delivery = data as WebhookDelivery;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/webhooks"
          className="text-sm text-[var(--primary)] hover:underline"
        >
          ← Back to deliveries
        </Link>
      </div>

      <h2 className="text-xl font-bold">Delivery Detail</h2>

      <div className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
        <Row label="ID" value={delivery.id} />
        <Row label="Idempotency Key" value={delivery.idempotency_key} />
        <Row label="Source" value={delivery.source} />
        <Row label="Event Type" value={delivery.event_type} />
        <Row label="Status" value={delivery.status} />
        <Row label="Attempts" value={String(delivery.attempts)} />
        {delivery.last_error && (
          <Row label="Last Error" value={delivery.last_error} />
        )}
        <Row
          label="Created At"
          value={new Date(delivery.created_at).toLocaleString()}
        />
        {delivery.processed_at && (
          <Row
            label="Processed At"
            value={new Date(delivery.processed_at).toLocaleString()}
          />
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Payload</h3>
        <pre className="rounded-lg bg-[var(--muted)] p-4 text-sm overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(delivery.payload, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex px-4 py-3 text-sm">
      <span className="w-40 shrink-0 font-medium text-[var(--muted-foreground)]">
        {label}
      </span>
      <span className="break-all">{value}</span>
    </div>
  );
}
