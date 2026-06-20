import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/adapters/supabase/client";
import { createWebhookEndpointRepo } from "@/adapters/supabase/webhook-endpoint-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { WEBHOOK_EVENT_TYPES } from "@/core/types";
import { EndpointList } from "@/app/_components/endpoint-list";
import { NewEndpointForm } from "@/app/_components/new-endpoint-form";

export const dynamic = "force-dynamic";

export default async function EndpointsPage() {
  const userCompany = await getUserCompany();
  if (!userCompany) redirect("/onboarding");

  const db = createServerClient();
  const repo = createWebhookEndpointRepo(db);

  let endpoints: Awaited<ReturnType<typeof repo.listByCompany>>;
  try {
    endpoints = await repo.listByCompany(userCompany.companyId);
  } catch {
    endpoints = [];
  }

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

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Webhook Endpoints</h2>
      </div>

      <NewEndpointForm eventTypes={WEBHOOK_EVENT_TYPES} />

      <EndpointList initialEndpoints={endpoints} />
    </div>
  );
}
