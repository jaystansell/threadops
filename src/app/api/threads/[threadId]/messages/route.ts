import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createMessageRepo } from "@/adapters/supabase/message-repo";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";
import { dispatchOutboundWebhooks } from "@/adapters/supabase/outbound-webhook";
import { hashKey } from "@/core/rules/api-key";
import { checkRateLimit, rateLimitResponse } from "@/core/rules/rate-limit";
import type { ThreadId, CompanyId, MessageMetadata } from "@/core/types";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalidThreadIdResponse(threadId: string) {
  return Response.json(
    {
      error: "Invalid thread ID format",
      hint: "Thread IDs must be valid UUIDs (e.g. 'dc9a8b2e-41b6-4491-98ce-511e3f3a44d3'). Use the thread_id from the webhook payload, or call GET /api/threads to list your threads.",
      received: threadId,
    },
    { status: 400 },
  );
}

function threadNotFoundResponse(threadId: string) {
  return Response.json(
    {
      error: "Thread not found",
      hint: "Verify the thread_id matches a value from a webhook payload or from GET /api/threads. Do not construct thread IDs manually.",
      thread_id_attempted: threadId,
    },
    { status: 404 },
  );
}

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/threads/[threadId]/messages">,
) {
  const { threadId } = await ctx.params;
  if (!UUID_RE.test(threadId)) return invalidThreadIdResponse(threadId);

  const db = createServerClient();

  const apiKey = req.headers.get("x-api-key");
  if (apiKey) {
    const apiKeyRepo = createApiKeyRepo(db);
    const keyHash = await hashKey(apiKey);
    const keyRecord = await apiKeyRepo.lookupByHash(keyHash);
    if (!keyRecord) {
      return Response.json({ error: "Invalid API key" }, { status: 401 });
    }
    const rl = checkRateLimit(keyHash);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs!);

    const { data: thread } = await db
      .from("threads")
      .select("company_id, agent_api_key_id")
      .eq("id", threadId)
      .single();
    if (!thread) return threadNotFoundResponse(threadId);
    if (thread.company_id !== keyRecord.company_id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (thread.agent_api_key_id && thread.agent_api_key_id !== keyRecord.id) {
      return Response.json(
        { error: "This thread belongs to another agent" },
        { status: 403 },
      );
    }
  } else {
    const supabase = await createAuthServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const messageRepo = createMessageRepo(db);

  try {
    const messages = await messageRepo.listByThread(threadId as ThreadId);
    return Response.json(messages);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/threads/[threadId]/messages">,
) {
  const apiKey = req.headers.get("x-api-key");
  let authorId: string;
  let authorKind: "user" | "agent";
  let authorName: string | null = null;
  let metadata: MessageMetadata | null = null;

  const { threadId } = await ctx.params;
  if (!UUID_RE.test(threadId)) return invalidThreadIdResponse(threadId);

  if (apiKey) {
    const db = createServerClient();
    const apiKeyRepo = createApiKeyRepo(db);
    const keyHash = await hashKey(apiKey);
    const keyRecord = await apiKeyRepo.lookupByHash(keyHash);
    if (!keyRecord) {
      return Response.json({ error: "Invalid API key" }, { status: 401 });
    }
    const rl = checkRateLimit(keyHash);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs!);

    const { data: thread } = await db
      .from("threads")
      .select("company_id, agent_api_key_id")
      .eq("id", threadId)
      .single();
    if (!thread) return threadNotFoundResponse(threadId);
    if (thread.company_id !== keyRecord.company_id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (thread.agent_api_key_id && thread.agent_api_key_id !== keyRecord.id) {
      return Response.json(
        { error: "This thread belongs to another agent" },
        { status: 403 },
      );
    }

    // Auto-assign ownership: if thread has no owner, claim it for this agent.
    // This prevents future cross-agent webhook broadcasting for legacy threads.
    if (!thread.agent_api_key_id) {
      await db
        .from("threads")
        .update({ agent_api_key_id: keyRecord.id })
        .eq("id", threadId);
    }

    await apiKeyRepo.touchLastUsed(keyRecord.id);
    authorId = keyRecord.id;
    authorKind = "agent";
    authorName = keyRecord.label;
    metadata = {
      source: "api",
      endpoint: `POST /api/threads/${threadId}/messages`,
      api_key_prefix: keyRecord.key_prefix,
      agent_label: keyRecord.label,
      thread_id: threadId,
    };
  } else {
    const supabase = await createAuthServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    authorId = user.id;
    authorKind = "user";
    metadata = {
      source: "browser",
      endpoint: `POST /api/threads/${threadId}/messages`,
      thread_id: threadId,
    };
  }

  const body = await req.json();

  if (!body.body || typeof body.body !== "string") {
    return Response.json(
      { error: "body is required and must be a string" },
      { status: 400 },
    );
  }

  const db = createServerClient();
  const messageRepo = createMessageRepo(db);

  try {
    const message = await messageRepo.create({
      thread_id: threadId as ThreadId,
      author_id: authorId,
      author_kind: authorKind,
      author_name: authorName,
      body: body.body,
      metadata,
    });

    // Auto-complete processing status when an agent posts a response
    if (authorKind === "agent") {
      await db.from("agent_processing_status").insert({
        thread_id: threadId,
        api_key_id: authorId,
        status: "completed",
      });
    }

    const { data: thread } = await db
      .from("threads")
      .select("company_id, summary, agent_api_key_id, status")
      .eq("id", threadId)
      .single();

    if (thread) {
      // Auto-reopen archived threads when an agent posts a message
      if (thread.status === "archived" && authorKind === "agent") {
        await db
          .from("threads")
          .update({ status: "open", updated_at: new Date().toISOString() })
          .eq("id", threadId);

        await db.from("thread_events").insert({
          thread_id: threadId,
          company_id: thread.company_id,
          event_type: "auto_reopened",
          actor_kind: "agent",
          actor_label: authorName,
          old_value: "archived",
          new_value: "open",
        });

        // Exclude the posting agent from the auto-reopen notification
        // since the reopen is a side-effect of its own message.
        const reopenExclude = authorKind === "agent" ? authorId : null;
        dispatchOutboundWebhooks(
          thread.company_id as CompanyId,
          "thread.status_changed",
          {
            thread_id: threadId,
            thread_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://threadzy.ai"}/threads/${threadId}`,
            reply_endpoint: `POST /api/threads/${threadId}/messages`,
            previous_status: "archived",
            new_status: "open",
            company_id: thread.company_id,
            updated_at: new Date().toISOString(),
            reason: "auto_reopened_by_agent_message",
          },
          thread.agent_api_key_id,
          reopenExclude,
        );
      }

      // Echo suppression: exclude the posting agent's endpoint so it
      // does not receive a webhook for its own message. Works for both
      // agent-owned threads and threads with no owning agent.
      const excludeId = authorKind === "agent" ? authorId : null;
      dispatchOutboundWebhooks(
        thread.company_id as CompanyId,
        "message.created",
        {
          message_id: message.id,
          thread_id: threadId,
          thread_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://threadzy.ai"}/threads/${threadId}`,
          reply_endpoint: `POST /api/threads/${threadId}/messages`,
          author_id: message.author_id,
          author_kind: message.author_kind,
          author_name: message.author_name,
          body: message.body,
          created_at: message.created_at,
          current_summary: thread.summary ?? null,
        },
        thread.agent_api_key_id,
        excludeId,
      );
    }

    return Response.json(message, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
