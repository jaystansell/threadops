import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { createAttachmentRepo } from "@/adapters/supabase/attachment-repo";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";
import { hashKey } from "@/core/rules/api-key";
import { checkRateLimit, rateLimitResponse } from "@/core/rules/rate-limit";
import type { AttachmentId } from "@/core/types";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/threads/[threadId]/messages/[messageId]/attachments/[attachmentId]/download">,
) {
  const { threadId, attachmentId } = await ctx.params;
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

  const db = createServerClient();
  const attachmentRepo = createAttachmentRepo(db);

  const attachment = await attachmentRepo.getById(
    attachmentId as AttachmentId,
  );
  if (!attachment) {
    return Response.json({ error: "Attachment not found" }, { status: 404 });
  }
  if (attachment.thread_id !== threadId) {
    return Response.json({ error: "Attachment not found" }, { status: 404 });
  }
  if (attachment.purged_at) {
    return Response.json(
      { error: "File has been purged and is no longer available" },
      { status: 410 },
    );
  }

  // Images and PDFs render inline in the browser; everything else forces download
  const inlineTypes = new Set([
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "application/pdf",
  ]);
  const renderInline = inlineTypes.has(attachment.content_type);

  const { data: signedUrlData, error: signedUrlError } = await db.storage
    .from("thread-attachments")
    .createSignedUrl(attachment.storage_path, 3600, {
      ...(renderInline ? {} : { download: attachment.filename }),
    });

  if (signedUrlError || !signedUrlData?.signedUrl) {
    return Response.json(
      { error: "Failed to generate download URL" },
      { status: 500 },
    );
  }

  return Response.json({
    url: signedUrlData.signedUrl,
    filename: attachment.filename,
    content_type: attachment.content_type,
    file_size: attachment.file_size,
  });
}
