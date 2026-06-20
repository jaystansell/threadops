import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { hashKey } from "@/core/rules/api-key";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await props.params;
  let companyId: string;
  let agentKeyId: string | null = null;

  const apiKey = req.headers.get("x-api-key");
  if (apiKey) {
    const db = createServerClient();
    const apiKeyRepo = createApiKeyRepo(db);
    const keyHash = await hashKey(apiKey);
    const keyRecord = await apiKeyRepo.lookupByHash(keyHash);
    if (!keyRecord) {
      return Response.json({ error: "Invalid API key" }, { status: 401 });
    }
    await apiKeyRepo.touchLastUsed(keyRecord.id);
    companyId = keyRecord.company_id;
    agentKeyId = keyRecord.id;
  } else {
    const userCompany = await getUserCompany();
    if (!userCompany) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    companyId = userCompany.companyId;
  }

  const db = createServerClient();

  // Verify thread exists and belongs to company (+ ownership check for agents)
  let verifyQuery = db
    .from("threads")
    .select("id")
    .eq("id", threadId)
    .eq("company_id", companyId);

  if (agentKeyId) {
    verifyQuery = verifyQuery.eq("agent_api_key_id", agentKeyId);
  }

  const { data: thread } = await verifyQuery.single();
  if (!thread) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  // Fetch summary log ordered newest first
  const { data: summaries, error } = await db
    .from("thread_summaries")
    .select("id, summary, author_kind, author_name, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ thread_id: threadId, summaries: summaries ?? [] });
}
