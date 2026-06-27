import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { createAttachmentRepo } from "@/adapters/supabase/attachment-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { dispatchOutboundWebhooks } from "@/adapters/supabase/outbound-webhook";
import { hashKey } from "@/core/rules/api-key";
import { checkRateLimit, rateLimitResponse } from "@/core/rules/rate-limit";
import type { CompanyId } from "@/core/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/threads/[threadId]/messages/[messageId]/ready
 *
 * Called after all attachments have been uploaded for a message that was
 * created with has_pending_attachments: true. Dispatches the message.created
 * webhook with attachment metadata so agents/humans receive file info in a
 * single event instead of racing against attachment uploads.
 *
 * Supports both browser cookie auth and API key auth.
 */
export async function POST(
  req: NextRequest,
  props: { params: Promise<{ threadId: string; messageId: string }> },
) {
  const { threadId, messageId } = await props.params;

  // Auth: browser cookie or API key
  const apiKey = req.headers.get("x-api-key");

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
    await apiKeyRepo.touchLastUsed(keyRecord.id);

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
    const userCompany = await getUserCompany();
    if (!userCompany) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = createServerClient();
    const { data: thread } = await db
      .from("threads")
      .select("company_id")
      .eq("id", threadId)
      .single();
    if (!thread || thread.company_id !== userCompany.companyId) {
      return Response.json({ error: "Thread not found" }, { status: 404 });
    }
  }

  const db = createServerClient();

  // Verify thread exists and get routing info
  const { data: thread } = await db
    .from("threads")
    .select("company_id, summary, agent_api_key_id")
    .eq("id", threadId)
    .single();

  if (!thread) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  // Atomically claim the deferred webhook (flip webhook_deferred true → false).
  // If the column hasn't been set or was already claimed, skip dispatch.
  const { data: claimed, error: claimErr } = await db
    .from("messages")
    .update({ webhook_deferred: false })
    .eq("id", messageId)
    .eq("thread_id", threadId)
    .eq("webhook_deferred", true)
    .select("id, author_id, author_kind, author_name, body, created_at")
    .single();

  if (claimErr && claimErr.code === "PGRST116") {
    // No row matched — either message doesn't exist or already dispatched
    const { data: exists } = await db
      .from("messages")
      .select("id")
      .eq("id", messageId)
      .eq("thread_id", threadId)
      .single();
    if (!exists) {
      return Response.json({ error: "Message not found" }, { status: 404 });
    }
    return Response.json(
      { ok: true, already_dispatched: true },
      { status: 200 },
    );
  }
  if (claimErr) {
    return Response.json({ error: claimErr.message }, { status: 500 });
  }

  const message = claimed!;

  // Fetch attachments and generate signed download URLs
  const attachmentRepo = createAttachmentRepo(db);
  const attachments = await attachmentRepo.listByMessage(messageId);

  const attachmentsWithUrls = await Promise.all(
    attachments.map(async (att) => {
      const { data: signedUrlData } = await db.storage
        .from("thread-attachments")
        .createSignedUrl(att.storage_path, 3600, { download: att.filename });

      return {
        attachment_id: att.id,
        filename: att.filename,
        content_type: att.content_type,
        file_size: att.file_size,
        download_url: signedUrlData?.signedUrl ?? null,
      };
    }),
  );

  // Dispatch message.created webhook with attachment metadata
  const excludeId = message.author_kind === "agent" ? message.author_id : null;
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
      attachments: attachmentsWithUrls,
    },
    thread.agent_api_key_id,
    excludeId,
  );

  return Response.json({ ok: true, attachments_count: attachmentsWithUrls.length });
}
