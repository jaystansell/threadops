import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createThreadRepo } from "@/adapters/supabase/thread-repo";
import { createMessageRepo } from "@/adapters/supabase/message-repo";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { dispatchOutboundWebhooks } from "@/adapters/supabase/outbound-webhook";
import { resolveApiKey } from "@/adapters/supabase/api-key-auth";
import type { CompanyId, ThreadId, ThreadStatus } from "@/core/types";

export const dynamic = "force-dynamic";

const VALID_STATUSES: ThreadStatus[] = ["open", "archived"];

export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10) || 100),
  );
  const offset = Math.max(
    0,
    parseInt(searchParams.get("offset") ?? "0", 10) || 0,
  );
  const searchQuery = searchParams.get("q")?.trim() ?? "";
  const statusParam = searchParams.get("status") ?? "";
  const tagsParam = searchParams.get("tags") ?? "";
  const metadataPrefix = "metadata.";

  const db = createServerClient();

  // If tag filtering is requested, first get matching thread IDs (scoped to company)
  let tagFilteredIds: string[] | null = null;
  if (tagsParam) {
    const requestedTags = tagsParam.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (requestedTags.length > 0) {
      // AND logic: thread must have ALL requested tags, scoped by company via join
      const { data: tagRows } = await db
        .from("thread_tags")
        .select("thread_id, tag, threads!inner(company_id)")
        .eq("threads.company_id", companyId)
        .in("tag", requestedTags);

      const threadTagCounts = new Map<string, number>();
      for (const row of tagRows ?? []) {
        threadTagCounts.set(row.thread_id, (threadTagCounts.get(row.thread_id) ?? 0) + 1);
      }
      tagFilteredIds = [];
      for (const [tid, count] of threadTagCounts) {
        if (count >= requestedTags.length) {
          tagFilteredIds.push(tid);
        }
      }
      if (tagFilteredIds.length === 0) {
        return Response.json([]);
      }
    }
  }

  let query = db
    .from("threads")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (agentKeyId) {
    query = query.eq("agent_api_key_id", agentKeyId);
  }
  if (VALID_STATUSES.includes(statusParam as ThreadStatus)) {
    query = query.eq("status", statusParam);
  }
  if (searchQuery) {
    const escaped = searchQuery.replace(/[%_\\]/g, "\\$&");
    query = query.ilike("title", `%${escaped}%`);
  }
  if (tagFilteredIds) {
    query = query.in("id", tagFilteredIds);
  }

  // Metadata filtering: ?metadata.key=value
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith(metadataPrefix)) {
      const metaKey = key.slice(metadataPrefix.length);
      query = query.eq(`metadata->>${metaKey}`, value);
    }
  }

  query = query.range(offset, offset + limit - 1);

  try {
    const { data, error } = await query;
    if (error) throw error;

    const threads = data ?? [];

    // Fetch last message + last agent message for each thread
    const [lastMsgResults, agentMsgResults] = await Promise.all([
      Promise.all(
        threads.map((thread) =>
          db
            .from("messages")
            .select("thread_id, author_kind, author_name, created_at")
            .eq("thread_id", thread.id)
            .order("created_at", { ascending: false })
            .limit(1),
        ),
      ),
      Promise.all(
        threads.map((thread) =>
          db
            .from("messages")
            .select("thread_id, author_name")
            .eq("thread_id", thread.id)
            .eq("author_kind", "agent")
            .order("created_at", { ascending: true })
            .limit(1),
        ),
      ),
    ]);

    const lastMsgMap = new Map<string, { author_kind: string; author_name: string | null; created_at: string }>();
    for (const { data: msgs } of lastMsgResults) {
      if (msgs && msgs.length > 0) {
        lastMsgMap.set(msgs[0].thread_id, msgs[0]);
      }
    }

    const agentMap = new Map<string, string>();
    for (const { data: msgs } of agentMsgResults) {
      if (msgs && msgs.length > 0 && msgs[0].author_name) {
        agentMap.set(msgs[0].thread_id, msgs[0].author_name);
      }
    }

    // Fetch tags for all threads
    const threadIds = threads.map((t: { id: string }) => t.id);
    const tagMap = new Map<string, string[]>();
    if (threadIds.length > 0) {
      const { data: allTags } = await db
        .from("thread_tags")
        .select("thread_id, tag")
        .in("thread_id", threadIds);
      for (const row of allTags ?? []) {
        const existing = tagMap.get(row.thread_id) ?? [];
        existing.push(row.tag);
        tagMap.set(row.thread_id, existing);
      }
    }

    // Back-fill agent_name from api_keys for threads assigned to an agent
    // but where the agent hasn't posted a message yet
    const missingAgentIds = threads
      .filter((t: { id: string; agent_api_key_id?: string | null }) =>
        t.agent_api_key_id && !agentMap.has(t.id))
      .map((t: { agent_api_key_id: string }) => t.agent_api_key_id);
    const keyLabelMap = new Map<string, string>();
    if (missingAgentIds.length > 0) {
      const { data: keyRows } = await db
        .from("api_keys")
        .select("id, label")
        .in("id", missingAgentIds);
      for (const row of keyRows ?? []) {
        keyLabelMap.set(row.id, row.label);
      }
    }

    const enriched = threads.map((thread) => {
      const lm = lastMsgMap.get(thread.id);
      const agentName = agentMap.get(thread.id)
        ?? (thread.agent_api_key_id ? keyLabelMap.get(thread.agent_api_key_id) : null)
        ?? null;
      return {
        ...thread,
        tags: tagMap.get(thread.id) ?? [],
        last_author_kind: lm?.author_kind ?? null,
        last_author_name: lm?.author_name ?? null,
        last_message_at: lm?.created_at ?? null,
        agent_name: agentName,
      };
    });

    return Response.json(enriched);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  let authorId: string;
  let authorKind: "user" | "agent" = "user";
  let authorName: string | null = null;
  let apiKeyCompanyId: string | null = null;

  const apiKeyResult = await resolveApiKey(req);
  if (apiKeyResult.kind === "invalid" || apiKeyResult.kind === "rate_limited") {
    return apiKeyResult.response;
  } else if (apiKeyResult.kind === "ok") {
    authorId = apiKeyResult.keyId;
    authorKind = "agent";
    authorName = apiKeyResult.keyLabel;
    apiKeyCompanyId = apiKeyResult.companyId;
  } else {
    const supabase = await createAuthServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    authorId = user.id;
  }

  const body = await req.json();

  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return Response.json(
      { error: "title is required and must be a non-empty string" },
      { status: 400 },
    );
  }

  const companyId = apiKeyCompanyId ?? body.company_id;

  if (!companyId || typeof companyId !== "string") {
    return Response.json(
      { error: "company_id is required" },
      { status: 400 },
    );
  }

  if (
    !body.message_body ||
    typeof body.message_body !== "string" ||
    !body.message_body.trim()
  ) {
    return Response.json(
      { error: "message_body is required and must be a non-empty string" },
      { status: 400 },
    );
  }

  const db = createServerClient();
  const threadRepo = createThreadRepo(db);
  const messageRepo = createMessageRepo(db);

  try {
    const agentKeyId =
      authorKind === "agent"
        ? authorId
        : typeof body.agent_api_key_id === "string" && body.agent_api_key_id
          ? body.agent_api_key_id
          : undefined;

    const thread = await threadRepo.create({
      company_id: companyId as CompanyId,
      title: body.title.trim(),
      created_by: authorId,
      agent_api_key_id: agentKeyId,
    });

    await messageRepo.create({
      thread_id: thread.id as ThreadId,
      author_id: authorId,
      author_kind: authorKind,
      author_name: authorName,
      body: body.message_body.trim(),
    });

    // Echo suppression: exclude the creating agent's endpoint so it
    // does not receive a webhook for its own thread creation.
    const excludeId = authorKind === "agent" ? authorId : null;
    dispatchOutboundWebhooks(
      companyId as CompanyId,
      "thread.created",
      {
        thread_id: thread.id,
        title: thread.title,
        status: thread.status,
        company_id: thread.company_id,
        created_by: thread.created_by,
        created_at: thread.created_at,
        current_summary: null,
      },
      thread.agent_api_key_id,
      excludeId,
    );

    return Response.json(thread, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
