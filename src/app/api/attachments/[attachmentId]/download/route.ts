import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";
import { hashKey } from "@/core/rules/api-key";
import { checkRateLimit, rateLimitResponse } from "@/core/rules/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/attachments/[attachmentId]/download">,
) {
  const { attachmentId } = await ctx.params;
  const db = createServerClient();

  const { data: attachment, error } = await db
    .from("message_attachments")
    .select("*")
    .eq("id", attachmentId)
    .single();

  if (error || !attachment) {
    return Response.json({ error: "Attachment not found" }, { status: 404 });
  }

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
    if (keyRecord.company_id !== attachment.company_id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
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

  const { data: signedUrl, error: signError } = await db.storage
    .from("thread-attachments")
    .createSignedUrl(attachment.storage_path, 3600, {
      download: attachment.filename,
    });

  if (signError || !signedUrl) {
    return Response.json(
      { error: "Failed to generate download URL" },
      { status: 500 },
    );
  }

  return Response.json({
    url: signedUrl.signedUrl,
    filename: attachment.filename,
    content_type: attachment.content_type,
    expires_in: 3600,
  });
}
