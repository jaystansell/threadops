import { createServerClient } from "@/adapters/supabase/client";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";

export const dynamic = "force-dynamic";

interface DeliveryStage {
  label: string;
  status: "complete" | "pending" | "failed" | "inactive";
  timestamp: string | null;
  detail: string | null;
}

interface DeliveryReceiptResponse {
  stages: DeliveryStage[];
  overall_status: "delivered" | "acknowledged" | "replied" | "pending" | "failed";
  webhook: {
    delivery_id: string;
    event_type: string;
    endpoint_url_masked: string | null;
    http_status: number | null;
    latency_ms: number | null;
    fired_at: string;
    responded_at: string | null;
    last_error: string | null;
  } | null;
  ack: {
    ack_at: string;
  } | null;
  reply: {
    message_id: string;
    author_name: string | null;
    body_preview: string;
    replied_at: string;
  } | null;
}

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    const pathParts = u.pathname.split("/");
    const truncatedPath =
      pathParts.length > 3
        ? pathParts.slice(0, 3).join("/") + "/..."
        : u.pathname;
    return `${u.protocol}//${u.hostname}${truncatedPath}`;
  } catch {
    return "***";
  }
}

function parseResponseCode(lastError: string | null): number | null {
  if (!lastError) return null;
  const match = lastError.match(/^HTTP (\d{3})/);
  return match ? parseInt(match[1], 10) : null;
}

function computeLatency(
  createdAt: string,
  processedAt: string | null,
): number | null {
  if (!processedAt) return null;
  return new Date(processedAt).getTime() - new Date(createdAt).getTime();
}

function bodyPreview(body: string, maxLen = 80): string {
  if (body.length <= maxLen) return body;
  return body.slice(0, maxLen) + "…";
}

/**
 * GET /api/threads/[threadId]/messages/[messageId]/delivery
 *
 * Returns the full delivery receipt for a user message:
 * stages array with webhook → HTTP response → agent ACK → agent reply,
 * plus structured data for each phase.
 */
export async function GET(
  _req: Request,
  props: { params: Promise<{ threadId: string; messageId: string }> },
) {
  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId, messageId } = await props.params;
  const db = createServerClient();

  // Verify thread belongs to this company
  const { data: thread } = await db
    .from("threads")
    .select("id, company_id, agent_api_key_id")
    .eq("id", threadId)
    .eq("company_id", userCompany.companyId)
    .single();

  if (!thread) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  // Verify message belongs to this thread and is a user message
  // Try with new FK column first; fall back if migration 037 not yet applied
  let message: { id: string; author_kind: string; created_at: string; webhook_delivery_id: string | null } | null = null;
  const { data: msgData, error: msgError } = await db
    .from("messages")
    .select("id, author_kind, created_at, webhook_delivery_id")
    .eq("id", messageId)
    .eq("thread_id", threadId)
    .single();

  if (msgError && msgError.message?.includes("webhook_delivery_id")) {
    // Column doesn't exist yet — retry without it
    const { data: fallbackMsg } = await db
      .from("messages")
      .select("id, author_kind, created_at")
      .eq("id", messageId)
      .eq("thread_id", threadId)
      .single();
    if (fallbackMsg) {
      message = { ...fallbackMsg, webhook_delivery_id: null };
    }
  } else {
    message = msgData;
  }

  if (!message) {
    return Response.json({ error: "Message not found" }, { status: 404 });
  }

  if (message.author_kind !== "user") {
    return Response.json({
      stages: [],
      overall_status: "inactive",
      webhook: null,
      ack: null,
      reply: null,
    });
  }

  // Find the next user message (to scope fallback ACK query)
  const { data: nextUserMsg } = await db
    .from("messages")
    .select("created_at")
    .eq("thread_id", threadId)
    .eq("author_kind", "user")
    .gt("created_at", message.created_at)
    .order("created_at", { ascending: true })
    .limit(1);

  const nextUserMsgTime = nextUserMsg?.[0]?.created_at ?? null;

  // Build delivery query — prefer direct FK, fall back to payload lookup
  // Use base columns that always exist; new columns (ack_at, reply_message_id) may not exist yet
  const deliverySelectBase = "id, status, event_type, last_error, created_at, processed_at";
  const deliverySelectFull = `${deliverySelectBase}, ack_at, reply_message_id`;

  const buildDeliveryQuery = (selectCols: string) => {
    return message.webhook_delivery_id
      ? db
          .from("webhook_deliveries")
          .select(selectCols)
          .eq("id", message.webhook_delivery_id)
          .limit(1)
      : db
          .from("webhook_deliveries")
          .select(selectCols)
          .eq("company_id", userCompany.companyId)
          .eq("source", "outbound")
          .filter("payload->>message_id", "eq", messageId)
          .order("created_at", { ascending: false })
          .limit(1);
  };

  const deliveryQuery = buildDeliveryQuery(deliverySelectFull);

  // Fetch delivery, fallback ACK, fallback reply, and endpoint in parallel
  const [deliveryResult, fallbackAckResult, fallbackReplyResult, endpointResult] =
    await Promise.all([
      deliveryQuery,

      // Fallback ACK from agent_processing_status (if delivery lacks ack_at)
      db
        .from("agent_processing_status")
        .select("status, created_at")
        .eq("thread_id", threadId)
        .eq("message_id", messageId)
        .order("created_at", { ascending: false })
        .limit(1)
        .then(async (res) => {
          if (res.data && res.data.length > 0) return res;
          let query = db
            .from("agent_processing_status")
            .select("status, created_at")
            .eq("thread_id", threadId)
            .is("message_id", null)
            .gt("created_at", message.created_at);
          if (nextUserMsgTime) {
            query = query.lt("created_at", nextUserMsgTime);
          }
          return query.order("created_at", { ascending: true }).limit(1);
        }),

      // Fallback reply: first agent message after this one (scoped to next user msg)
      (() => {
        let query = db
          .from("messages")
          .select("id, author_name, body, created_at")
          .eq("thread_id", threadId)
          .eq("author_kind", "agent")
          .gt("created_at", message.created_at);
        if (nextUserMsgTime) {
          query = query.lt("created_at", nextUserMsgTime);
        }
        return query.order("created_at", { ascending: true }).limit(1);
      })(),

      // Endpoint URL
      thread.agent_api_key_id
        ? db
            .from("webhook_endpoints")
            .select("url")
            .eq("api_key_id", thread.agent_api_key_id)
            .eq("active", true)
            .limit(1)
        : Promise.resolve({ data: null }),
    ]);

  // Normalized delivery record with guaranteed shape
  interface DeliveryRecord {
    id: string;
    status: string;
    event_type: string;
    last_error: string | null;
    created_at: string;
    processed_at: string | null;
    ack_at: string | null;
    reply_message_id: string | null;
  }

  // If delivery query failed (new columns don't exist), retry with base columns only
  let delivery: DeliveryRecord | null = null;
  const rawDelivery = deliveryResult.data?.[0];
  if (!rawDelivery && deliveryResult.error) {
    const retryResult = await buildDeliveryQuery(deliverySelectBase);
    const retryRow = retryResult.data?.[0] as Record<string, unknown> | undefined;
    if (retryRow) {
      delivery = {
        id: retryRow.id as string,
        status: retryRow.status as string,
        event_type: retryRow.event_type as string,
        last_error: (retryRow.last_error as string) ?? null,
        created_at: retryRow.created_at as string,
        processed_at: (retryRow.processed_at as string) ?? null,
        ack_at: null,
        reply_message_id: null,
      };
    }
  } else if (rawDelivery) {
    const row = rawDelivery as unknown as Record<string, unknown>;
    delivery = {
      id: row.id as string,
      status: row.status as string,
      event_type: row.event_type as string,
      last_error: (row.last_error as string) ?? null,
      created_at: row.created_at as string,
      processed_at: (row.processed_at as string) ?? null,
      ack_at: (row.ack_at as string) ?? null,
      reply_message_id: (row.reply_message_id as string) ?? null,
    };
  }
  const fallbackAck = fallbackAckResult.data?.[0] ?? null;
  const fallbackReply = fallbackReplyResult.data?.[0] ?? null;
  const endpoint = endpointResult.data?.[0] ?? null;

  // Resolve ACK: prefer delivery.ack_at, then fallback
  const ackAt: string | null = delivery?.ack_at ?? fallbackAck?.created_at ?? null;

  // Resolve reply: prefer delivery.reply_message_id with a fetch, then fallback
  let replyData: { message_id: string; author_name: string | null; body_preview: string; replied_at: string } | null = null;

  if (delivery?.reply_message_id) {
    const { data: replyMsg } = await db
      .from("messages")
      .select("id, author_name, body, created_at")
      .eq("id", delivery.reply_message_id)
      .single();
    if (replyMsg) {
      replyData = {
        message_id: replyMsg.id,
        author_name: replyMsg.author_name,
        body_preview: bodyPreview(replyMsg.body),
        replied_at: replyMsg.created_at,
      };
    }
  } else if (fallbackReply) {
    replyData = {
      message_id: fallbackReply.id,
      author_name: fallbackReply.author_name,
      body_preview: bodyPreview(fallbackReply.body),
      replied_at: fallbackReply.created_at,
    };
  }

  // Build stages
  const hasDelivery = delivery !== null;
  const deliveryStatus: "complete" | "pending" | "failed" | "inactive" =
    !hasDelivery || !delivery
      ? "inactive"
      : delivery.status === "succeeded"
        ? "complete"
        : delivery.status === "failed"
          ? "failed"
          : "pending";

  const httpStatus =
    delivery?.status === "succeeded"
      ? 200
      : parseResponseCode(delivery?.last_error ?? null);

  const latencyMs = delivery
    ? computeLatency(delivery.created_at, delivery.processed_at)
    : null;

  const ackStatus: "complete" | "pending" | "failed" | "inactive" = ackAt
    ? "complete"
    : deliveryStatus === "failed"
      ? "inactive"
      : deliveryStatus === "complete"
        ? "pending"
        : "inactive";

  const replyStatus: "complete" | "pending" | "failed" | "inactive" = replyData
    ? "complete"
    : ackStatus === "complete"
      ? "pending"
      : "inactive";

  const stages: DeliveryStage[] = [
    {
      label: "Webhook Fired",
      status: deliveryStatus,
      timestamp: delivery?.created_at ?? null,
      detail: endpoint?.url ? maskUrl(endpoint.url) : null,
    },
    {
      label: "HTTP Response",
      status: deliveryStatus,
      timestamp: delivery?.processed_at ?? null,
      detail: httpStatus ? `${httpStatus}${latencyMs !== null ? ` · ${latencyMs}ms` : ""}` : null,
    },
    {
      label: "Agent ACK",
      status: ackStatus,
      timestamp: ackAt,
      detail: ackAt ? "Acknowledged" : null,
    },
    {
      label: "Agent Reply",
      status: replyStatus,
      timestamp: replyData?.replied_at ?? null,
      detail: replyData?.body_preview ?? null,
    },
  ];

  const overallStatus: DeliveryReceiptResponse["overall_status"] = replyData
    ? "replied"
    : ackAt
      ? "acknowledged"
      : deliveryStatus === "complete"
        ? "delivered"
        : deliveryStatus === "failed"
          ? "failed"
          : "pending";

  const response: DeliveryReceiptResponse = {
    stages,
    overall_status: overallStatus,
    webhook: delivery
      ? {
          delivery_id: delivery.id,
          event_type: delivery.event_type,
          endpoint_url_masked: endpoint?.url ? maskUrl(endpoint.url) : null,
          http_status: httpStatus,
          latency_ms: latencyMs,
          fired_at: delivery.created_at,
          responded_at: delivery.processed_at,
          last_error: delivery.last_error,
        }
      : null,
    ack: ackAt ? { ack_at: ackAt } : null,
    reply: replyData,
  };

  return Response.json(response);
}
