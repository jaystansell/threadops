import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createMessageRepo } from "@/adapters/supabase/message-repo";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";
import { dispatchOutboundWebhooks } from "@/adapters/supabase/outbound-webhook";
import { hashKey } from "@/core/rules/api-key";
import type { ThreadId, CompanyId } from "@/core/types";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/threads/[threadId]/messages">,
) {
  const { threadId } = await ctx.params;
  const db = createServerClient();

  const apiKey = req.headers.get("x-api-key");
  if (apiKey) {
    const apiKeyRepo = createApiKeyRepo(db);
    const keyHash = await hashKey(apiKey);
    const keyRecord = await apiKeyRepo.lookupByHash(keyHash);
    if (!keyRecord) {
      return Response.json({ error: "Invalid API key" }, { status: 401 });
    }

    const { data: thread } = await db
      .from("threads")
      .select("company_id, agent_api_key_id")
      .eq("id", threadId)
      .single();
    if (!thread) {
      return Response.json({ error: "Thread not found" }, { status: 404 });
    }
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

  const { threadId } = await ctx.params;

  if (apiKey) {
    const db = createServerClient();
    const apiKeyRepo = createApiKeyRepo(db);
    const keyHash = await hashKey(apiKey);
    const keyRecord = await apiKeyRepo.lookupByHash(keyHash);
    if (!keyRecord) {
      return Response.json({ error: "Invalid API key" }, { status: 401 });
    }

    const { data: thread } = await db
      .from("threads")
      .select("company_id, agent_api_key_id")
      .eq("id", threadId)
      .single();
    if (!thread) {
      return Response.json({ error: "Thread not found" }, { status: 404 });
    }
    if (thread.company_id !== keyRecord.company_id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (thread.agent_api_key_id && thread.agent_api_key_id !== keyRecord.id) {
      return Response.json(
        { error: "This thread belongs to another agent" },
        { status: 403 },
      );
    }

    await apiKeyRepo.touchLastUsed(keyRecord.id);
    authorId = keyRecord.id;
    authorKind = "agent";
    authorName = keyRecord.label;
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
    });

    const { data: thread } = await db
      .from("threads")
      .select("company_id, summary, agent_api_key_id")
      .eq("id", threadId)
      .single();

    if (thread) {
      dispatchOutboundWebhooks(
        thread.company_id as CompanyId,
        "message.created",
        {
          message_id: message.id,
          thread_id: threadId,
          author_id: message.author_id,
          author_kind: message.author_kind,
          author_name: message.author_name,
          body: message.body,
          created_at: message.created_at,
          current_summary: thread.summary ?? null,
        },
        thread.agent_api_key_id,
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
