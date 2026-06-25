import { createServerClient } from "@/adapters/supabase/client";
import { createAttachmentRepo } from "@/adapters/supabase/attachment-repo";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";
import { dispatchOutboundWebhooks } from "@/adapters/supabase/outbound-webhook";
import type { CompanyId } from "@/core/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/threads/[threadId]/messages/[messageId]/ready
 *
 * Called after all attachments have been uploaded for a message that was
 * created with has_pending_attachments: true. Dispatches the message.created
 * webhook with attachment metadata so agents receive file info in a single
 * event instead of racing against attachment uploads.
 */
export async function POST(
  _req: Request,
  props: { params: Promise<{ threadId: string; messageId: string }> },
) {
  const { threadId, messageId } = await props.params;

  // Auth: only browser-authenticated users can call this (it's a UI flow)
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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

  // Verify message exists and belongs to thread
  const { data: message } = await db
    .from("messages")
    .select("id, author_id, author_kind, author_name, body, created_at")
    .eq("id", messageId)
    .eq("thread_id", threadId)
    .single();

  if (!message) {
    return Response.json({ error: "Message not found" }, { status: 404 });
  }

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
