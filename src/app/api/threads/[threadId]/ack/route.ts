import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { hashKey } from "@/core/rules/api-key";
import { checkRateLimit, rateLimitResponse } from "@/core/rules/rate-limit";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATUSES = ["acknowledged", "processing", "completed", "escalated"];

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await props.params;

  // API key auth only
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return Response.json(
      { error: "API key required. Include X-API-Key header." },
      { status: 401 },
    );
  }

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

  // Validate threadId format
  if (!UUID_RE.test(threadId)) {
    return Response.json(
      {
        error: "Invalid thread ID format",
        hint: "Thread IDs must be valid UUIDs.",
        received: threadId,
      },
      { status: 400 },
    );
  }

  // Validate request body
  const body = await req.json();
  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return Response.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  if (body.message_id && !UUID_RE.test(body.message_id)) {
    return Response.json(
      { error: "message_id must be a valid UUID" },
      { status: 400 },
    );
  }

  // Verify thread exists and belongs to the agent's company
  const { data: thread } = await db
    .from("threads")
    .select("id, company_id")
    .eq("id", threadId)
    .eq("company_id", keyRecord.company_id)
    .single();

  if (!thread) {
    return Response.json(
      {
        error: "Thread not found",
        hint: "Verify the thread_id matches a value from a webhook payload or from GET /api/threads.",
      },
      { status: 404 },
    );
  }

  // Insert the processing status record
  const { data, error } = await db
    .from("agent_processing_status")
    .insert({
      thread_id: threadId,
      api_key_id: keyRecord.id,
      message_id: body.message_id || null,
      status: body.status,
    })
    .select()
    .single();

  if (error) {
    return Response.json(
      { error: error.message },
      { status: 500 },
    );
  }

  return Response.json(data, { status: 200 });
}
