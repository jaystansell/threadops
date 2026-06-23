import { createServerClient } from "@/adapters/supabase/client";
import { createWebhookRepo } from "@/adapters/supabase/webhook-repo";
import { createWebhookEndpointRepo } from "@/adapters/supabase/webhook-endpoint-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { SIGNATURE_HEADER } from "@/core/rules/webhook";
import type { CompanyId, WebhookDeliveryId } from "@/core/types";

export const dynamic = "force-dynamic";

async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchThreadContext(
  db: ReturnType<typeof createServerClient>,
  threadId: string,
) {
  try {
    const [threadResult, messagesResult, countResult, tagsResult] =
      await Promise.all([
        db
          .from("threads")
          .select("title, status, summary")
          .eq("id", threadId)
          .single(),
        db
          .from("messages")
          .select("body, author_kind, author_name, created_at")
          .eq("thread_id", threadId)
          .order("created_at", { ascending: false })
          .limit(5),
        db
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("thread_id", threadId),
        db
          .from("thread_tags")
          .select("tag")
          .eq("thread_id", threadId),
      ]);

    if (threadResult.error || !threadResult.data) return null;

    const thread = threadResult.data;
    const recentMessages = (messagesResult.data ?? []).map(
      (m: { body: string; author_kind: string; author_name: string | null; created_at: string }) => ({
        body: m.body.length > 500 ? m.body.slice(0, 500) : m.body,
        author_kind: m.author_kind,
        author_name: m.author_name,
        created_at: m.created_at,
      }),
    );

    return {
      thread_summary: thread.summary ?? null,
      thread_tags: (tagsResult.data ?? []).map((t: { tag: string }) => t.tag),
      thread_status: thread.status,
      thread_title: thread.title,
      recent_messages: recentMessages,
      message_count: countResult.count ?? 0,
      reply_endpoint: `POST /api/threads/${threadId}/messages`,
      ack_endpoint: `POST /api/threads/${threadId}/ack`,
    };
  } catch {
    return null;
  }
}

/**
 * POST /api/webhook-deliveries/[deliveryId]/retry
 *
 * Re-fires a failed webhook delivery to the same endpoint.
 */
export async function POST(
  _req: Request,
  props: { params: Promise<{ deliveryId: string }> },
) {
  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deliveryId } = await props.params;
  const db = createServerClient();
  const webhookRepo = createWebhookRepo(db);
  const endpointRepo = createWebhookEndpointRepo(db);

  // Fetch the delivery record
  const { data: delivery, error: fetchError } = await db
    .from("webhook_deliveries")
    .select("*")
    .eq("company_id", userCompany.companyId)
    .eq("id", deliveryId)
    .single();

  if (fetchError && fetchError.code === "PGRST116") {
    return Response.json({ error: "Delivery not found" }, { status: 404 });
  }
  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  if (delivery.status === "succeeded") {
    return Response.json(
      { error: "Delivery already succeeded" },
      { status: 400 },
    );
  }

  // Use the same endpoint resolution as the original dispatch:
  // 1. Filter by event type (respects ALWAYS_ON_EVENTS)
  const allEndpointsRaw = await endpointRepo.listActiveForEvent(
    userCompany.companyId as CompanyId,
    delivery.event_type,
  );

  // 2. Filter out endpoints whose API key has been revoked
  const keyIds = [...new Set(allEndpointsRaw.map((ep) => ep.api_key_id).filter(Boolean))] as string[];
  let revokedKeyIds = new Set<string>();
  if (keyIds.length > 0) {
    const { data: revokedRows } = await db
      .from("api_keys")
      .select("id")
      .in("id", keyIds)
      .not("revoked_at", "is", null);
    revokedKeyIds = new Set((revokedRows ?? []).map((r: { id: string }) => r.id));
  }
  const allEndpoints = allEndpointsRaw.filter(
    (ep) => !ep.api_key_id || !revokedKeyIds.has(ep.api_key_id),
  );

  // 3. Apply thread ownership scoping (same as original dispatch)
  const threadId = (delivery.payload as Record<string, unknown>)?.thread_id as string | undefined;
  let agentApiKeyId: string | null = null;
  if (threadId) {
    const { data: thread } = await db
      .from("threads")
      .select("api_key_id")
      .eq("id", threadId)
      .single();
    agentApiKeyId = thread?.api_key_id ?? null;
  }

  const endpoints = delivery.event_type === "docs.updated"
    ? allEndpoints
    : allEndpoints.filter((ep) => {
        if (!agentApiKeyId) return !ep.api_key_id;
        return ep.api_key_id === agentApiKeyId;
      });

  if (endpoints.length === 0) {
    return Response.json(
      { error: "No active webhook endpoint found" },
      { status: 404 },
    );
  }

  const endpoint = endpoints[0];

  // 4. Fetch thread context if endpoint wants it (matches original dispatch)
  let context: Record<string, unknown> | null = null;
  if (threadId && endpoint.include_context !== false) {
    context = await fetchThreadContext(db, threadId);
  }

  // Build the envelope matching the original dispatch format
  const envelopeObj: Record<string, unknown> = {
    event: delivery.event_type,
    payload: delivery.payload,
    timestamp: new Date().toISOString(),
  };
  if (context) {
    envelopeObj.context = context;
  }
  const envelope = JSON.stringify(envelopeObj);

  try {
    const signature = await signPayload(envelope, endpoint.secret);
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [SIGNATURE_HEADER]: signature,
        "x-idempotency-key": delivery.idempotency_key,
        "x-retry": "true",
      },
      body: envelope,
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) {
      await webhookRepo.updateStatus(
        deliveryId as WebhookDeliveryId,
        "succeeded",
      );
      return Response.json({ success: true, status: response.status });
    } else {
      await webhookRepo.updateStatus(
        deliveryId as WebhookDeliveryId,
        "failed",
        `HTTP ${response.status}: ${response.statusText}`,
      );
      return Response.json({
        success: false,
        status: response.status,
        error: `HTTP ${response.status}: ${response.statusText}`,
      });
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    await webhookRepo.updateStatus(
      deliveryId as WebhookDeliveryId,
      "failed",
      errorMessage,
    );
    return Response.json(
      { success: false, error: errorMessage },
      { status: 502 },
    );
  }
}
