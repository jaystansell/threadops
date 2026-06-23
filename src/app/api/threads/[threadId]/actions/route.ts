import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { dispatchOutboundWebhooks } from "@/adapters/supabase/outbound-webhook";
import type { CompanyId } from "@/core/types";

export const dynamic = "force-dynamic";

const VALID_ACTIONS = ["generate_summary", "generate_tags"] as const;
type ActionType = (typeof VALID_ACTIONS)[number];

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await props.params;

  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const action = body.action as string;

  if (!VALID_ACTIONS.includes(action as ActionType)) {
    return Response.json(
      { error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}` },
      { status: 400 },
    );
  }

  const db = createServerClient();
  const { data: thread } = await db
    .from("threads")
    .select("company_id, agent_api_key_id, title, summary, status")
    .eq("id", threadId)
    .eq("company_id", userCompany.companyId)
    .single();

  if (!thread) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  if (!thread.agent_api_key_id) {
    return Response.json(
      { error: "This thread has no owning agent to handle the action" },
      { status: 422 },
    );
  }

  dispatchOutboundWebhooks(
    thread.company_id as CompanyId,
    "action.requested",
    {
      action,
      thread_id: threadId,
      thread_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://threadzy.ai"}/threads/${threadId}`,
      reply_endpoint: `POST /api/threads/${threadId}/messages`,
      thread_title: thread.title,
      current_summary: thread.summary ?? null,
    },
    thread.agent_api_key_id,
  );

  return Response.json({ ok: true, action, thread_id: threadId });
}
