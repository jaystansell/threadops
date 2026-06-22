import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { resolveApiKey } from "@/adapters/supabase/api-key-auth";

export const dynamic = "force-dynamic";

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
