import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { dispatchOutboundWebhooks } from "@/adapters/supabase/outbound-webhook";
import type { CompanyId } from "@/core/types";

export const dynamic = "force-dynamic";

/**
 * Cron: detect threads where a webhook was successfully delivered but the agent
 * never acknowledged within the company's configured ACK timeout window.
 * Marks those threads as "unhandled" and optionally fires a thread.unhandled event.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServerClient();

  // Fetch all companies with their ACK timeout setting
  const { data: companies, error: compErr } = await db
    .from("companies")
    .select("id, ack_timeout_seconds");

  if (compErr || !companies) {
    return Response.json({ error: compErr?.message ?? "No companies" }, { status: 500 });
  }

  let totalMarked = 0;
  const results: { company_id: string; threads_marked: number }[] = [];

  for (const company of companies) {
    const timeoutSeconds = (company.ack_timeout_seconds as number) || 60;
    const cutoff = new Date(Date.now() - timeoutSeconds * 1000).toISOString();

    // Find outbound webhook deliveries that succeeded before the cutoff
    // for message.created or thread.created events in open threads
    const { data: deliveries } = await db
      .from("webhook_deliveries")
      .select("id, payload, created_at")
      .eq("company_id", company.id)
      .eq("source", "outbound")
      .eq("status", "succeeded")
      .in("event_type", ["message.created", "thread.created"])
      .lt("created_at", cutoff);

    if (!deliveries || deliveries.length === 0) {
      continue;
    }

    // Extract unique thread IDs from delivery payloads
    const threadIds = new Set<string>();
    for (const d of deliveries) {
      const payload = d.payload as Record<string, unknown>;
      const tid = payload.thread_id as string | undefined;
      if (tid) threadIds.add(tid);
    }

    if (threadIds.size === 0) continue;

    // Filter to threads that are still open
    const { data: openThreads } = await db
      .from("threads")
      .select("id")
      .eq("company_id", company.id)
      .eq("status", "open")
      .in("id", [...threadIds]);

    if (!openThreads || openThreads.length === 0) continue;

    const openThreadIds = openThreads.map((t: { id: string }) => t.id);

    // For each open thread, check if there's an ACK after the delivery
    // (any status in agent_processing_status means the agent responded)
    const { data: ackRows } = await db
      .from("agent_processing_status")
      .select("thread_id, status, created_at")
      .in("thread_id", openThreadIds)
      .order("created_at", { ascending: false });

    // Build map: thread_id → latest status
    const latestStatus = new Map<string, string>();
    for (const row of ackRows ?? []) {
      if (!latestStatus.has(row.thread_id)) {
        latestStatus.set(row.thread_id, row.status);
      }
    }

    // Threads that need marking: no ACK at all, or already "unhandled" should not be re-marked
    const threadsToMark: string[] = [];
    for (const tid of openThreadIds) {
      const currentStatus = latestStatus.get(tid);
      // Skip if already acknowledged, processing, or already unhandled
      if (currentStatus === "acknowledged" || currentStatus === "processing" || currentStatus === "unhandled") {
        continue;
      }
      // If completed or escalated, the agent already handled it
      if (currentStatus === "completed" || currentStatus === "escalated") {
        continue;
      }
      // No status record at all — agent never responded
      threadsToMark.push(tid);
    }

    if (threadsToMark.length === 0) continue;

    // Insert "unhandled" status records
    const inserts = threadsToMark.map((tid) => ({
      thread_id: tid,
      api_key_id: "00000000-0000-0000-0000-000000000000", // system-generated
      status: "unhandled",
    }));

    const { error: insertErr } = await db
      .from("agent_processing_status")
      .insert(inserts);

    if (insertErr) {
      continue;
    }

    totalMarked += threadsToMark.length;
    results.push({ company_id: company.id, threads_marked: threadsToMark.length });

    // Fire thread.unhandled webhook for each marked thread
    for (const tid of threadsToMark) {
      dispatchOutboundWebhooks(
        company.id as CompanyId,
        "thread.unhandled",
        { thread_id: tid, reason: "ack_timeout", timeout_seconds: timeoutSeconds },
      );
    }
  }

  return Response.json({
    checked_companies: companies.length,
    total_threads_marked: totalMarked,
    results,
  });
}
