import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";

export const dynamic = "force-dynamic";

/**
 * Daily cron: find agents whose keys have been shared (shared_at IS NOT NULL)
 * but still have no webhook registered. Returns the list for monitoring.
 *
 * When an email provider is configured (Resend/SendGrid), this endpoint will
 * also send reminder emails to the key creator.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServerClient();

  // Find active (non-revoked) API keys that have been shared but have no webhook
  const { data: allKeys, error: keysErr } = await db
    .from("api_keys")
    .select("id, label, company_id, created_by, shared_at")
    .is("revoked_at", null)
    .not("shared_at", "is", null);

  if (keysErr) {
    return Response.json({ error: keysErr.message }, { status: 500 });
  }

  if (!allKeys || allKeys.length === 0) {
    return Response.json({ reminded: 0, agents: [] });
  }

  // Get all active webhook endpoints
  const { data: webhooks } = await db
    .from("webhook_endpoints")
    .select("api_key_id")
    .eq("active", true);

  const webhookKeyIds = new Set(
    (webhooks ?? []).map((w: { api_key_id: string | null }) => w.api_key_id).filter(Boolean),
  );

  // Filter to keys without webhooks
  const missingWebhook = allKeys.filter(
    (k: { id: string }) => !webhookKeyIds.has(k.id),
  );

  if (missingWebhook.length === 0) {
    return Response.json({ reminded: 0, agents: [] });
  }

  // Look up creator emails via company_members -> auth.users
  // Note: service role needed to query auth.users; for now, return the list
  // and the UI checklist handles the user-facing warning.
  const agents = missingWebhook.map((k: { id: string; label: string; company_id: string; shared_at: string }) => ({
    key_id: k.id,
    label: k.label,
    company_id: k.company_id,
    shared_at: k.shared_at,
  }));

  // TODO: When email provider is configured, send reminder emails here:
  // for (const agent of agents) {
  //   const creatorEmail = await lookupCreatorEmail(agent.company_id, agent.created_by);
  //   await sendReminderEmail(creatorEmail, agent.label);
  // }

  return Response.json({
    reminded: agents.length,
    agents,
    note: "Email sending not yet configured. Agents listed above have shared keys but no webhook.",
  });
}
