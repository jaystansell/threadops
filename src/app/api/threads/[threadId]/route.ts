import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { logThreadRead } from "@/adapters/supabase/usage-log-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { hashKey } from "@/core/rules/api-key";
import { checkRateLimit, rateLimitResponse } from "@/core/rules/rate-limit";
import type { ApiKeyId, CompanyId } from "@/core/types";

export const dynamic = "force-dynamic";

type ApiKeyResult =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "rate_limited"; retryAfterMs: number }
  | { kind: "ok"; companyId: string; keyId: string; keyLabel: string; modelTier: string | null };

async function resolveApiKeyCompany(req: NextRequest): Promise<ApiKeyResult> {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return { kind: "none" };
  const db = createServerClient();
  const apiKeyRepo = createApiKeyRepo(db);
  const keyHash = await hashKey(apiKey);
  const keyRecord = await apiKeyRepo.lookupByHash(keyHash);
  if (!keyRecord) return { kind: "invalid" };
  const rl = checkRateLimit(keyHash);
  if (!rl.allowed) return { kind: "rate_limited" as const, retryAfterMs: rl.retryAfterMs! };
  await apiKeyRepo.touchLastUsed(keyRecord.id);
  return { kind: "ok", companyId: keyRecord.company_id, keyId: keyRecord.id, keyLabel: keyRecord.label, modelTier: keyRecord.model_tier };
}

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await props.params;
  let companyId: string;
  let agentKeyId: string | null = null;

  const apiKeyResult = await resolveApiKeyCompany(req);
  if (apiKeyResult.kind === "invalid") {
    return Response.json({ error: "Invalid API key" }, { status: 401 });
  } else if (apiKeyResult.kind === "rate_limited") {
    return rateLimitResponse(apiKeyResult.retryAfterMs);
  } else if (apiKeyResult.kind === "ok") {
    companyId = apiKeyResult.companyId;
    agentKeyId = apiKeyResult.keyId;
  } else {
    const userCompany = await getUserCompany();
    if (!userCompany) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    companyId = userCompany.companyId;
  }

  const db = createServerClient();

  let query = db
    .from("threads")
    .select("*")
    .eq("id", threadId)
    .eq("company_id", companyId);

  if (agentKeyId) {
    query = query.eq("agent_api_key_id", agentKeyId);
  }

  const { data, error } = await query.single();
  if (error && error.code === "PGRST116") {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Also fetch tags (graceful if thread_tags table doesn't exist yet)
  const { data: tags, error: tagsError } = await db
    .from("thread_tags")
    .select("tag")
    .eq("thread_id", threadId);

  const enriched = {
    ...data,
    tags: tagsError ? [] : (tags ?? []).map((t: { tag: string }) => t.tag),
  };

  // Log usage for agent reads (fire-and-forget, non-blocking)
  if (agentKeyId) {
    const storedTier = apiKeyResult.kind === "ok" ? apiKeyResult.modelTier : null;
    const ua = req.headers.get("user-agent");
    (async () => {
      const { count } = await db
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("thread_id", threadId);
      if (count && count > 0) {
        await logThreadRead(db, {
          apiKeyId: agentKeyId as ApiKeyId,
          companyId: companyId as CompanyId,
          threadId,
          messageCount: count,
          userAgent: ua,
          storedModelTier: storedTier,
        });
      }
    })().catch(() => {});
  }

  return Response.json(enriched);
}

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await props.params;
  let companyId: string;
  let agentKeyId: string | null = null;

  const apiKeyResult = await resolveApiKeyCompany(req);
  if (apiKeyResult.kind === "invalid") {
    return Response.json({ error: "Invalid API key" }, { status: 401 });
  } else if (apiKeyResult.kind === "rate_limited") {
    return rateLimitResponse(apiKeyResult.retryAfterMs);
  } else if (apiKeyResult.kind === "ok") {
    companyId = apiKeyResult.companyId;
    agentKeyId = apiKeyResult.keyId;
  } else {
    const userCompany = await getUserCompany();
    if (!userCompany) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    companyId = userCompany.companyId;
  }

  const db = createServerClient();

  // Verify thread exists and belongs to company
  let verifyQuery = db
    .from("threads")
    .select("id")
    .eq("id", threadId)
    .eq("company_id", companyId);

  if (agentKeyId) {
    verifyQuery = verifyQuery.eq("agent_api_key_id", agentKeyId);
  }

  const { data: existing } = await verifyQuery.single();
  if (!existing) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ("summary" in body) {
    if (body.summary !== null && typeof body.summary !== "string") {
      return Response.json({ error: "summary must be a string or null" }, { status: 400 });
    }
    updates.summary = body.summary;
  }

  if ("title" in body) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return Response.json({ error: "title must be a non-empty string" }, { status: 400 });
    }
    updates.title = body.title.trim();
  }

  if (Object.keys(updates).length === 1) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    const { data, error } = await db
      .from("threads")
      .update(updates)
      .eq("id", threadId)
      .eq("company_id", companyId)
      .select()
      .single();

    if (error) throw error;

    // Append to summary log after successful update
    if (updates.summary && typeof updates.summary === "string") {
      const authorKind = agentKeyId ? "agent" : "user";
      const authorName = apiKeyResult.kind === "ok" ? apiKeyResult.keyLabel : undefined;
      const { error: logError } = await db.from("thread_summaries").insert({
        thread_id: threadId,
        summary: updates.summary,
        author_kind: authorKind,
        author_name: authorName ?? null,
      });
      if (logError) {
        console.error("Failed to insert summary log entry:", logError.message);
      }
    }

    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
