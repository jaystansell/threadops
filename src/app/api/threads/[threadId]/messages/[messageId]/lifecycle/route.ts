import { createServerClient } from "@/adapters/supabase/client";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";

export const dynamic = "force-dynamic";

interface LifecycleDelivery {
  id: string;
  status: "pending" | "processing" | "succeeded" | "failed";
  event_type: string;
  endpoint_url_masked: string | null;
  response_code: number | null;
  latency_ms: number | null;
  created_at: string;
  processed_at: string | null;
  last_error: string | null;
}

interface LifecycleAck {
  status: string;
  created_at: string;
}

interface LifecycleReply {
  message_id: string;
  author_name: string | null;
  created_at: string;
}

interface LifecycleResponse {
  delivery: LifecycleDelivery | null;
  ack: LifecycleAck | null;
  reply: LifecycleReply | null;
}

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const pathParts = u.pathname.split("/");
    const truncatedPath =
      pathParts.length > 3
        ? pathParts.slice(0, 3).join("/") + "/..."
        : u.pathname;
    return `${u.protocol}//${host}${truncatedPath}`;
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

/**
 * GET /api/threads/[threadId]/messages/[messageId]/lifecycle
 *
 * Returns the full delivery lifecycle for a user message:
 * - Webhook delivery status + latency + response code
 * - Agent ACK status
 * - Agent reply status (link to reply message)
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
  const { data: message } = await db
    .from("messages")
    .select("id, author_kind, created_at")
    .eq("id", messageId)
    .eq("thread_id", threadId)
    .single();

  if (!message) {
    return Response.json({ error: "Message not found" }, { status: 404 });
  }

  // Only user messages trigger outbound webhooks
  if (message.author_kind !== "user") {
    return Response.json({
      delivery: null,
      ack: null,
      reply: null,
    } satisfies LifecycleResponse);
  }

  // Fetch delivery, ACK, and reply in parallel
  const [deliveryResult, ackResult, replyResult, endpointResult] =
    await Promise.all([
      // 1. Webhook delivery for this message
      db
        .from("webhook_deliveries")
        .select(
          "id, status, event_type, last_error, created_at, processed_at",
        )
        .eq("company_id", userCompany.companyId)
        .eq("source", "outbound")
        .filter("payload->>message_id", "eq", messageId)
        .order("created_at", { ascending: false })
        .limit(1),

      // 2. ACK status: first try message-specific, then fall back to thread-level
      db
        .from("agent_processing_status")
        .select("status, created_at")
        .eq("thread_id", threadId)
        .eq("message_id", messageId)
        .order("created_at", { ascending: false })
        .limit(1)
        .then(async (res) => {
          if (res.data && res.data.length > 0) return res;
          // Fallback: thread-level ACK created after this message
          return db
            .from("agent_processing_status")
            .select("status, created_at")
            .eq("thread_id", threadId)
            .is("message_id", null)
            .gt("created_at", message.created_at)
            .order("created_at", { ascending: true })
            .limit(1);
        }),

      // 3. First agent reply after this message
      db
        .from("messages")
        .select("id, author_name, created_at")
        .eq("thread_id", threadId)
        .eq("author_kind", "agent")
        .gt("created_at", message.created_at)
        .order("created_at", { ascending: true })
        .limit(1),

      // 4. Endpoint URL (from the agent's webhook endpoint)
      thread.agent_api_key_id
        ? db
            .from("webhook_endpoints")
            .select("url")
            .eq("api_key_id", thread.agent_api_key_id)
            .eq("active", true)
            .limit(1)
        : Promise.resolve({ data: null }),
    ]);

  const delivery = deliveryResult.data?.[0] ?? null;
  const ack = ackResult.data?.[0] ?? null;
  const reply = replyResult.data?.[0] ?? null;
  const endpoint = endpointResult.data?.[0] ?? null;

  const response: LifecycleResponse = {
    delivery: delivery
      ? {
          id: delivery.id,
          status: delivery.status,
          event_type: delivery.event_type,
          endpoint_url_masked: endpoint?.url
            ? maskUrl(endpoint.url)
            : null,
          response_code:
            delivery.status === "succeeded"
              ? 200
              : parseResponseCode(delivery.last_error),
          latency_ms: computeLatency(
            delivery.created_at,
            delivery.processed_at,
          ),
          created_at: delivery.created_at,
          processed_at: delivery.processed_at,
          last_error: delivery.last_error,
        }
      : null,
    ack: ack
      ? {
          status: ack.status,
          created_at: ack.created_at,
        }
      : null,
    reply: reply
      ? {
          message_id: reply.id,
          author_name: reply.author_name,
          created_at: reply.created_at,
        }
      : null,
  };

  return Response.json(response);
}
