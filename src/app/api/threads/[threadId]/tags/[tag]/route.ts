import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { resolveApiKey } from "@/adapters/supabase/api-key-auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ threadId: string; tag: string }> },
) {
  const { threadId, tag } = await props.params;
  let companyId: string;
  let agentKeyId: string | null = null;

  const apiKeyResult = await resolveApiKey(req);
  if (apiKeyResult.kind === "invalid" || apiKeyResult.kind === "rate_limited") {
    return apiKeyResult.response;
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

  // Verify thread belongs to company
  let threadQuery = db
    .from("threads")
    .select("id")
    .eq("id", threadId)
    .eq("company_id", companyId);

  if (agentKeyId) {
    threadQuery = threadQuery.eq("agent_api_key_id", agentKeyId);
  }

  const { data: threadData } = await threadQuery.single();
  if (!threadData) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  try {
    const decodedTag = decodeURIComponent(tag).toLowerCase();
    const { error } = await db
      .from("thread_tags")
      .delete()
      .eq("thread_id", threadId)
      .eq("tag", decodedTag);

    if (error) throw error;
    return Response.json({ message: "Tag removed" });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
