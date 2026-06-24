import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { dispatchOutboundWebhooks } from "@/adapters/supabase/outbound-webhook";
import type { CompanyId } from "@/core/types";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  props: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await props.params;

  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServerClient();

  const { data: thread } = await db
    .from("threads")
    .select("id, company_id, agent_api_key_id, status")
    .eq("id", threadId)
    .eq("company_id", userCompany.companyId)
    .maybeSingle();

  if (!thread) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  // Fetch the most recent message for the webhook payload
  const { data: lastMessage } = await db
    .from("messages")
    .select("id, author_id, author_kind, author_name, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://threadzy.ai";

  dispatchOutboundWebhooks(
    userCompany.companyId as CompanyId,
    "message.created",
    {
      message_id: lastMessage?.id ?? null,
      thread_id: threadId,
      thread_url: `${appUrl}/threads/${threadId}`,
      reply_endpoint: `POST /api/threads/${threadId}/messages`,
      author_id: lastMessage?.author_id ?? null,
      author_kind: lastMessage?.author_kind ?? "human",
      author_name: lastMessage?.author_name ?? null,
      body: lastMessage?.body ?? "",
      created_at: lastMessage?.created_at ?? new Date().toISOString(),
      redispatch: true,
    },
    thread.agent_api_key_id,
  );

  // Clear the unhandled status so the agent gets a fresh ACK window
  await db
    .from("agent_processing_status")
    .delete()
    .eq("thread_id", threadId)
    .eq("status", "unhandled");

  return Response.json({ success: true, thread_id: threadId });
}
