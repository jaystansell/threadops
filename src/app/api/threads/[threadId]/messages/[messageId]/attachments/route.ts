import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { createAttachmentRepo } from "@/adapters/supabase/attachment-repo";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";
import { dispatchOutboundWebhooks } from "@/adapters/supabase/outbound-webhook";
import { hashKey } from "@/core/rules/api-key";
import {
  FILE_LIMITS,
  isAllowedFile,
  validateMagicBytes,
} from "@/core/types";
import type { CompanyId } from "@/core/types";

export const dynamic = "force-dynamic";

interface AuthResult {
  companyId: string;
  apiKeyId?: string;
}

async function authenticateRequest(
  req: NextRequest,
  threadId: string,
): Promise<AuthResult | Response> {
  const apiKey = req.headers.get("x-api-key");

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

    return { companyId: keyRecord.company_id, apiKeyId: keyRecord.id };
  }

  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServerClient();
  const { data: thread } = await db
    .from("threads")
    .select("company_id")
    .eq("id", threadId)
    .single();
  if (!thread) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  return { companyId: thread.company_id };
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/threads/[threadId]/messages/[messageId]/attachments">,
) {
  const { threadId, messageId } = await ctx.params;

  const authResult = await authenticateRequest(req, threadId);
  if (authResult instanceof Response) return authResult;

  const db = createServerClient();
  const attachmentRepo = createAttachmentRepo(db);

  // Rate limiting: max uploads per minute per company
  const recentCount = await attachmentRepo.countRecentByCompany(
    authResult.companyId,
    1,
  );
  if (recentCount >= FILE_LIMITS.RATE_LIMIT_PER_MINUTE) {
    return Response.json(
      { error: "Rate limit exceeded. Max 20 uploads per minute." },
      { status: 429 },
    );
  }

  // Verify message exists and belongs to thread
  const { data: message } = await db
    .from("messages")
    .select("id")
    .eq("id", messageId)
    .eq("thread_id", threadId)
    .single();
  if (!message) {
    return Response.json({ error: "Message not found" }, { status: 404 });
  }

  // Check attachment count limit
  const existingCount = await attachmentRepo.countByMessage(messageId);
  if (existingCount >= FILE_LIMITS.MAX_FILES_PER_MESSAGE) {
    return Response.json(
      {
        error: `Maximum ${FILE_LIMITS.MAX_FILES_PER_MESSAGE} files per message`,
      },
      { status: 400 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return Response.json(
      { error: "No file provided. Use multipart form data with a 'file' field." },
      { status: 400 },
    );
  }

  const filename = file.name;
  const contentType = file.type || "application/octet-stream";
  const fileSize = file.size;

  // Validate file type and size
  const validation = isAllowedFile(filename, contentType, fileSize);
  if (!validation.ok) {
    return Response.json({ error: validation.reason }, { status: 400 });
  }

  // Read file buffer for magic bytes validation
  const buffer = new Uint8Array(await file.arrayBuffer());
  const magicCheck = validateMagicBytes(buffer, contentType);
  if (!magicCheck.ok) {
    return Response.json({ error: magicCheck.reason }, { status: 400 });
  }

  // Upload to Supabase Storage
  const storagePath = `${authResult.companyId}/${threadId}/${messageId}/${filename}`;

  const { error: uploadError } = await db.storage
    .from("thread-attachments")
    .upload(storagePath, buffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    return Response.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 },
    );
  }

  const attachment = await attachmentRepo.create({
    message_id: messageId,
    thread_id: threadId,
    company_id: authResult.companyId as CompanyId,
    filename,
    file_size: fileSize,
    content_type: contentType,
    storage_path: storagePath,
  });

  // Generate a signed download URL for the agent (valid 1 hour)
  const { data: signedUrlData } = await db.storage
    .from("thread-attachments")
    .createSignedUrl(storagePath, 3600, { download: filename });

  // Look up thread to get company + owning agent for webhook routing
  const { data: thread } = await db
    .from("threads")
    .select("company_id, agent_api_key_id")
    .eq("id", threadId)
    .single();

  if (thread) {
    dispatchOutboundWebhooks(
      thread.company_id as CompanyId,
      "attachment.created",
      {
        attachment_id: attachment.id,
        message_id: messageId,
        thread_id: threadId,
        filename,
        content_type: contentType,
        file_size: fileSize,
        download_url: signedUrlData?.signedUrl ?? null,
      },
      thread.agent_api_key_id,
    );
  }

  return Response.json(attachment, { status: 201 });
}

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/threads/[threadId]/messages/[messageId]/attachments">,
) {
  const { threadId, messageId } = await ctx.params;

  const authResult = await authenticateRequest(req, threadId);
  if (authResult instanceof Response) return authResult;

  const db = createServerClient();
  const attachmentRepo = createAttachmentRepo(db);

  const attachments = await attachmentRepo.listByMessage(messageId);
  return Response.json(attachments);
}
