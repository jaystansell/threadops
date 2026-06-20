import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { hashKey } from "@/core/rules/api-key";

export const dynamic = "force-dynamic";

type ApiKeyResult =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "ok"; companyId: string; keyId: string };

async function resolveApiKeyCompany(req: NextRequest): Promise<ApiKeyResult> {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return { kind: "none" };
  const db = createServerClient();
  const apiKeyRepo = createApiKeyRepo(db);
  const keyHash = await hashKey(apiKey);
  const keyRecord = await apiKeyRepo.lookupByHash(keyHash);
  if (!keyRecord) return { kind: "invalid" };
  await apiKeyRepo.touchLastUsed(keyRecord.id);
  return { kind: "ok", companyId: keyRecord.company_id, keyId: keyRecord.id };
}

async function verifyThreadOwnership(
  db: ReturnType<typeof createServerClient>,
  threadId: string,
  companyId: string,
  agentKeyId: string | null,
): Promise<boolean> {
  let query = db
    .from("threads")
    .select("id")
    .eq("id", threadId)
    .eq("company_id", companyId);

  if (agentKeyId) {
    query = query.eq("agent_api_key_id", agentKeyId);
  }

  const { data } = await query.single();
  return !!data;
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await props.params;
  let companyId: string;
  let agentKeyId: string | null = null;

  const apiKeyResult = await resolveApiKeyCompany(req);
  if (apiKeyResult.kind === "invalid") {
    return Response.json({ error: "Invalid API key" }, { status: 401 });
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

  const hasAccess = await verifyThreadOwnership(db, threadId, companyId, agentKeyId);
  if (!hasAccess) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  const body = await req.json();
  const tags: string[] = body.tags;

  if (!Array.isArray(tags) || tags.length === 0) {
    return Response.json({ error: "tags must be a non-empty array of strings" }, { status: 400 });
  }

  const validTags = tags.filter((t) => typeof t === "string" && t.trim().length > 0).map((t) => t.trim().toLowerCase());
  if (validTags.length === 0) {
    return Response.json({ error: "tags must contain at least one valid string" }, { status: 400 });
  }

  try {
    const rows = validTags.map((tag) => ({ thread_id: threadId, tag }));
    const { data, error } = await db
      .from("thread_tags")
      .upsert(rows, { onConflict: "thread_id,tag" })
      .select();

    if (error) throw error;
    return Response.json(data, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
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

  const hasAccess = await verifyThreadOwnership(db, threadId, companyId, agentKeyId);
  if (!hasAccess) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  try {
    const { data, error } = await db
      .from("thread_tags")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
