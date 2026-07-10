import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { createThreadRepo } from "@/adapters/supabase/thread-repo";
import { createMessageRepo } from "@/adapters/supabase/message-repo";
import { dispatchOutboundWebhooks } from "@/adapters/supabase/outbound-webhook";
import type { CompanyId, ThreadId } from "@/core/types";

export const dynamic = "force-dynamic";

const TEST_TITLE_PREFIX = "[Connection test]";
const TEST_MESSAGE = "Threadzy connection test — please acknowledge and reply.";

async function requireCompany() {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return getUserCompany();
}

async function getOwnedAgent(apiKeyId: string, companyId: string) {
  const db = createServerClient();
  const { data: apiKey } = await db
    .from("api_keys")
    .select("id, company_id, label")
    .eq("id", apiKeyId)
    .eq("company_id", companyId)
    .is("revoked_at", null)
    .single();
  return apiKey;
}

export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/agents/[apiKeyId]/connection-test">,
) {
  const userCompany = await requireCompany();
  if (!userCompany) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { apiKeyId } = await ctx.params;
  const apiKey = await getOwnedAgent(apiKeyId, userCompany.companyId);
  if (!apiKey) return Response.json({ error: "Agent not found" }, { status: 404 });

  const db = createServerClient();
  const thread = await createThreadRepo(db).create({
    company_id: userCompany.companyId as CompanyId,
    title: `${TEST_TITLE_PREFIX} ${new Date().toISOString()}`,
    created_by: userCompany.userId,
    agent_api_key_id: apiKey.id,
  });
  const message = await createMessageRepo(db).create({
    thread_id: thread.id as ThreadId,
    author_id: userCompany.userId,
    author_kind: "user",
    author_name: null,
    body: TEST_MESSAGE,
  });

  dispatchOutboundWebhooks(
    userCompany.companyId as CompanyId,
    "message.created",
    {
      message_id: message.id,
      thread_id: thread.id,
      thread_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://threadzy.ai"}/threads/${thread.id}`,
      reply_endpoint: `POST /api/threads/${thread.id}/messages`,
      author_id: message.author_id,
      author_kind: "user",
      author_name: message.author_name,
      body: message.body,
      created_at: message.created_at,
      current_summary: null,
    },
    apiKey.id,
  );

  return Response.json({ test_id: thread.id, thread_id: thread.id, message_id: message.id }, { status: 201 });
}

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/agents/[apiKeyId]/connection-test">,
) {
  const userCompany = await requireCompany();
  if (!userCompany) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { apiKeyId } = await ctx.params;
  const apiKey = await getOwnedAgent(apiKeyId, userCompany.companyId);
  if (!apiKey) return Response.json({ error: "Agent not found" }, { status: 404 });
  const testId = new URL(req.url).searchParams.get("test_id");
  if (!testId) return Response.json({ error: "test_id is required" }, { status: 400 });

  const db = createServerClient();
  const { data: activeEndpoints } = await db
    .from("webhook_endpoints")
    .select("id")
    .eq("company_id", userCompany.companyId)
    .eq("api_key_id", apiKeyId)
    .eq("active", true);
  if (!activeEndpoints || activeEndpoints.length === 0) {
    return Response.json({
      stage: "failed",
      explanation: "We have nowhere to deliver events. Register a webhook endpoint.",
      deliveryStatus: null,
      deliveryError: null,
    });
  }
  const { data: thread } = await db
    .from("threads")
    .select("id, company_id, agent_api_key_id")
    .eq("id", testId)
    .eq("company_id", userCompany.companyId)
    .eq("agent_api_key_id", apiKeyId)
    .single();
  if (!thread) return Response.json({ error: "Connection test not found" }, { status: 404 });

  const { data: userMessage } = await db
    .from("messages")
    .select("id, created_at")
    .eq("thread_id", testId)
    .eq("author_kind", "user")
    .ilike("body", `${TEST_MESSAGE}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!userMessage) return Response.json({ stage: "pending", explanation: "The test message is still being created.", deliveryStatus: null, deliveryError: null });

  const { data: deliveries } = await db
    .from("webhook_deliveries")
    .select("status, last_error, created_at, event_type, payload, endpoint_id")
    .eq("company_id", userCompany.companyId)
    .eq("event_type", "message.created")
    .order("created_at", { ascending: false })
    .limit(100);
  const delivery = (deliveries ?? []).find((item) => item.payload?.thread_id === testId);
  if (!delivery || delivery.status === "pending" || delivery.status === "processing") {
    return Response.json({
      stage: "pending",
      explanation: "The test message was sent. Waiting for the webhook delivery result.",
      deliveryStatus: delivery?.status ?? null,
      deliveryError: delivery?.last_error ?? null,
    });
  }
  if (delivery.status === "failed") {
    const error = delivery.last_error ?? "the receiver returned an error";
    return Response.json({
      stage: "failed",
      explanation: error.startsWith("HTTP ")
        ? `Your endpoint returned ${error}. The receiver is erroring.`
        : `We could not deliver the event: ${error}.`,
      deliveryStatus: delivery.status,
      deliveryError: error,
    });
  }

  const { data: ack } = await db
    .from("agent_processing_status")
    .select("created_at")
    .eq("thread_id", testId)
    .eq("api_key_id", apiKeyId)
    .gte("created_at", userMessage.created_at)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const { data: reply } = await db
    .from("messages")
    .select("id")
    .eq("thread_id", testId)
    .eq("author_kind", "agent")
    .gt("created_at", userMessage.created_at)
    .limit(1)
    .maybeSingle();
  if (reply) {
    return Response.json({ stage: "replied", explanation: "Delivered, acknowledged, and answered. The full round-trip is working.", deliveryStatus: delivery.status, deliveryError: null });
  }
  if (ack) {
    return Response.json({ stage: "acknowledged", explanation: "Acknowledged but no reply yet. The handler is running but did not post a response.", deliveryStatus: delivery.status, deliveryError: null });
  }
  return Response.json({
    stage: "delivered",
    explanation: "Delivered successfully, but your agent never acknowledged. Your endpoint received the event but no handler acted on it. MCP access alone does not make your agent respond. You need a persistent handler that invokes your agent on webhook receipt.",
    deliveryStatus: delivery.status,
    deliveryError: null,
  });
}
