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

  // Fetch current thread
  let threadQuery = db
    .from("threads")
    .select("id, metadata")
    .eq("id", threadId)
    .eq("company_id", companyId);

  if (agentKeyId) {
    threadQuery = threadQuery.eq("agent_api_key_id", agentKeyId);
  }

  const { data: thread, error: threadError } = await threadQuery.single();
  if (threadError && threadError.code === "PGRST116") {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }
  if (threadError) {
    return Response.json({ error: threadError.message }, { status: 500 });
  }

  const body = await req.json();
  const metadataUpdate = body.metadata;
  const unsetKeys: string[] = body.unset ?? [];

  if (!metadataUpdate && unsetKeys.length === 0) {
    return Response.json(
      { error: "metadata or unset is required" },
      { status: 400 },
    );
  }

  try {
    // Merge semantics: existing metadata + new keys, then remove unset keys
    const currentMetadata = (thread.metadata as Record<string, unknown>) ?? {};
    const merged = { ...currentMetadata, ...(metadataUpdate ?? {}) };

    for (const key of unsetKeys) {
      delete merged[key];
    }

    const { data, error } = await db
      .from("threads")
      .update({ metadata: merged, updated_at: new Date().toISOString() })
      .eq("id", threadId)
      .eq("company_id", companyId)
      .select()
      .single();

    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
