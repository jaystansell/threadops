import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { dispatchOutboundWebhooks } from "@/adapters/supabase/outbound-webhook";
import type { CompanyId } from "@/core/types";

export const dynamic = "force-dynamic";

/**
 * Cron: detect threads where an outbound webhook delivery succeeded but the
 * agent never ACK'd within the endpoint's configured timeout window.
 *
 * For each such thread, inserts an "unhandled" agent_processing_status record
 * and fires a thread.unhandled webhook event.
 *
 * Uses per-endpoint `ack_timeout_seconds` from webhook_endpoints.
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServerClient();

  // Fetch all active webhook endpoints with their timeout settings
  const { data: endpoints, error: epErr } = await db
    .from("webhook_endpoints")
    .select("id, company_id, api_key_id, ack_timeout_seconds")
    .eq("active", true);

  if (epErr || !endpoints) {
    return Response.json({ error: epErr?.message ?? "No endpoints" }, { status: 500 });
  }

  // Group endpoints by company for batch processing
  const endpointsByCompany = new Map<string, Array<{ id: string; api_key_id: string | null; ack_timeout_seconds: number }>>();
  for (const ep of endpoints) {
    const companyId = ep.company_id as string;
    if (!endpointsByCompany.has(companyId)) {
      endpointsByCompany.set(companyId, []);
    }
    endpointsByCompany.get(companyId)!.push({
      id: ep.id as string,
      api_key_id: ep.api_key_id as string | null,
      ack_timeout_seconds: (ep.ack_timeout_seconds as number) ?? 60,
    });
  }

  let totalMarked = 0;
  const results: { company_id: string; threads_marked: number }[] = [];

  // Only scan deliveries from the last 24 hours to bound query size
  const lowerBound = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  for (const [companyId, companyEndpoints] of endpointsByCompany) {
    // Use the minimum timeout across endpoints for the initial query window,
    // then refine per-endpoint below
    const minTimeout = Math.min(...companyEndpoints.map((ep) => ep.ack_timeout_seconds));
    const cutoff = new Date(Date.now() - minTimeout * 1000).toISOString();

    // Find outbound deliveries that succeeded before the cutoff
    const { data: deliveries } = await db
      .from("webhook_deliveries")
      .select("id, payload, created_at")
      .eq("company_id", companyId)
      .eq("source", "outbound")
      .eq("status", "succeeded")
      .in("event_type", ["message.created", "thread.created"])
      .gt("created_at", lowerBound)
      .lt("created_at", cutoff);

    if (!deliveries || deliveries.length === 0) continue;

    // Extract unique thread IDs from delivery payloads
    const threadIds = new Set<string>();
    // Track the oldest delivery per thread for timeout comparison
    const oldestDeliveryPerThread = new Map<string, string>();
    for (const d of deliveries) {
      const payload = d.payload as Record<string, unknown>;
      const tid = payload.thread_id as string | undefined;
      if (!tid) continue;
      threadIds.add(tid);
      const existing = oldestDeliveryPerThread.get(tid);
      if (!existing || d.created_at < existing) {
        oldestDeliveryPerThread.set(tid, d.created_at as string);
      }
    }

    if (threadIds.size === 0) continue;

    // Filter to threads that are still open
    const { data: openThreads } = await db
      .from("threads")
      .select("id, agent_api_key_id")
      .eq("company_id", companyId)
      .eq("status", "open")
      .in("id", [...threadIds]);

    if (!openThreads || openThreads.length === 0) continue;

    const openThreadIds = openThreads.map((t: { id: string }) => t.id);
    const threadAgentKeyMap = new Map<string, string | null>();
    for (const t of openThreads as { id: string; agent_api_key_id: string | null }[]) {
      threadAgentKeyMap.set(t.id, t.agent_api_key_id);
    }

    // Check existing ACK statuses
    const { data: ackRows } = await db
      .from("agent_processing_status")
      .select("thread_id, status, created_at")
      .in("thread_id", openThreadIds)
      .order("created_at", { ascending: false });

    const latestStatus = new Map<string, string>();
    for (const row of ackRows ?? []) {
      if (!latestStatus.has(row.thread_id)) {
        latestStatus.set(row.thread_id, row.status);
      }
    }

    // Build lookup: api_key_id → endpoint timeout
    const keyTimeoutMap = new Map<string, number>();
    for (const ep of companyEndpoints) {
      if (ep.api_key_id) {
        const existing = keyTimeoutMap.get(ep.api_key_id);
        if (existing === undefined || ep.ack_timeout_seconds < existing) {
          keyTimeoutMap.set(ep.api_key_id, ep.ack_timeout_seconds);
        }
      }
    }

    const threadsToMark: string[] = [];
    for (const tid of openThreadIds) {
      const currentStatus = latestStatus.get(tid);
      // Skip threads already handled
      if (currentStatus === "acknowledged" || currentStatus === "processing" ||
          currentStatus === "unhandled" || currentStatus === "completed" ||
          currentStatus === "escalated") {
        continue;
      }

      const agentKeyId = threadAgentKeyMap.get(tid);
      if (!agentKeyId) continue;

      // Use the endpoint's timeout for this agent, or default to 60s
      const timeout = keyTimeoutMap.get(agentKeyId) ?? 60;
      const threadCutoff = new Date(Date.now() - timeout * 1000).toISOString();
      const deliveryAt = oldestDeliveryPerThread.get(tid);
      if (!deliveryAt || deliveryAt >= threadCutoff) continue;

      threadsToMark.push(tid);
    }

    if (threadsToMark.length === 0) continue;

    // Insert "unhandled" status records
    const inserts = threadsToMark.map((tid) => ({
      thread_id: tid,
      api_key_id: threadAgentKeyMap.get(tid)!,
      status: "unhandled",
    }));

    const { error: insertErr } = await db
      .from("agent_processing_status")
      .insert(inserts);

    if (insertErr) continue;

    totalMarked += threadsToMark.length;
    results.push({ company_id: companyId, threads_marked: threadsToMark.length });

    // Fire thread.unhandled webhook for each marked thread
    for (const tid of threadsToMark) {
      const agentKeyId = threadAgentKeyMap.get(tid);
      const timeout = agentKeyId ? (keyTimeoutMap.get(agentKeyId) ?? 60) : 60;
      dispatchOutboundWebhooks(
        companyId as CompanyId,
        "thread.unhandled",
        { thread_id: tid, reason: "ack_timeout", timeout_seconds: timeout },
        agentKeyId,
      );
    }
  }

  return Response.json({
    checked_endpoints: endpoints.length,
    total_threads_marked: totalMarked,
    results,
  });
}

// Vercel Cron sends GET requests; delegate to the same handler.
export async function GET(req: NextRequest) {
  return POST(req);
}
