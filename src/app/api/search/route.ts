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

function highlightMatch(text: string, query: string): string {
  const words = query.split(/\s+/).filter(Boolean);
  // Truncate first, then highlight to avoid offset drift
  const firstWordRegex = new RegExp(words[0]?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") ?? "", "i");
  const matchIndex = text.search(firstWordRegex);
  let truncated = text;
  if (matchIndex > 50) {
    truncated = "..." + text.slice(Math.max(0, matchIndex - 50));
  }
  if (truncated.length > 200) {
    truncated = truncated.slice(0, 200) + "...";
  }
  // Now apply highlights to the truncated text
  let highlighted = truncated;
  for (const word of words) {
    const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    highlighted = highlighted.replace(regex, "**$1**");
  }
  return highlighted;
}

export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim();
  if (!query) {
    return Response.json({ error: "q parameter is required" }, { status: 400 });
  }

  const scope = searchParams.get("scope") ?? "all";
  if (!["messages", "threads", "all"].includes(scope)) {
    return Response.json({ error: "scope must be messages, threads, or all" }, { status: 400 });
  }

  const statusFilter = searchParams.get("status") ?? null;
  const authorKindFilter = searchParams.get("author_kind") ?? null;
  const createdAfter = searchParams.get("created_after") ?? null;
  const createdBefore = searchParams.get("created_before") ?? null;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") ?? "20", 10) || 20));
  const offset = (page - 1) * perPage;

  const db = createServerClient();

  // Convert query to tsquery format
  const tsquery = query
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean)
    .join(" & ");

  if (!tsquery) {
    return Response.json({ results: [], total: 0, page, per_page: perPage });
  }

  const results: Array<{
    type: "thread" | "message";
    thread_id: string;
    thread_title?: string;
    message_id?: string;
    body?: string;
    highlight: string;
    author_kind?: string;
    created_at: string;
  }> = [];
  let total = 0;

  try {
    if (scope === "threads" || scope === "all") {
      let threadQuery = db
        .from("threads")
        .select("id, title, status, created_at", { count: scope === "threads" ? "exact" : undefined })
        .eq("company_id", companyId)
        .textSearch("search_vector", tsquery);

      if (agentKeyId) {
        threadQuery = threadQuery.eq("agent_api_key_id", agentKeyId);
      }
      if (statusFilter) {
        threadQuery = threadQuery.eq("status", statusFilter);
      }
      if (createdAfter) {
        threadQuery = threadQuery.gte("created_at", createdAfter);
      }
      if (createdBefore) {
        threadQuery = threadQuery.lte("created_at", createdBefore);
      }

      if (scope === "threads") {
        threadQuery = threadQuery.range(offset, offset + perPage - 1);
      } else {
        threadQuery = threadQuery.limit(100);
      }

      threadQuery = threadQuery.order("created_at", { ascending: false });

      const { data: threadData, count: threadCount, error: threadError } = await threadQuery;
      if (threadError) throw threadError;

      if (scope === "threads") {
        total = threadCount ?? 0;
      }

      for (const thread of threadData ?? []) {
        results.push({
          type: "thread",
          thread_id: thread.id,
          thread_title: thread.title,
          highlight: highlightMatch(thread.title, query),
          created_at: thread.created_at,
        });
      }
    }

    if (scope === "messages" || scope === "all") {
      let msgQuery = db
        .from("messages")
        .select("id, thread_id, body, author_kind, created_at, threads!inner(company_id, agent_api_key_id, status)", { count: "exact" })
        .eq("threads.company_id", companyId)
        .textSearch("search_vector", tsquery);

      if (agentKeyId) {
        msgQuery = msgQuery.eq("threads.agent_api_key_id", agentKeyId);
      }
      if (statusFilter) {
        msgQuery = msgQuery.eq("threads.status", statusFilter);
      }
      if (authorKindFilter) {
        msgQuery = msgQuery.eq("author_kind", authorKindFilter);
      }
      if (createdAfter) {
        msgQuery = msgQuery.gte("created_at", createdAfter);
      }
      if (createdBefore) {
        msgQuery = msgQuery.lte("created_at", createdBefore);
      }

      if (scope === "messages") {
        msgQuery = msgQuery.range(offset, offset + perPage - 1);
      } else {
        msgQuery = msgQuery.limit(100);
      }

      msgQuery = msgQuery.order("created_at", { ascending: false });

      const { data: msgData, count: msgCount, error: msgError } = await msgQuery;
      if (msgError) throw msgError;

      if (scope === "messages") {
        total = msgCount ?? 0;
      }

      for (const msg of msgData ?? []) {
        results.push({
          type: "message",
          thread_id: msg.thread_id,
          message_id: msg.id,
          body: msg.body,
          highlight: highlightMatch(msg.body ?? "", query),
          author_kind: msg.author_kind,
          created_at: msg.created_at,
        });
      }
    }

    // For "all" scope, sort combined results and paginate
    if (scope === "all") {
      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      total = results.length;
      const paged = results.slice(offset, offset + perPage);
      return Response.json({ results: paged, total, page, per_page: perPage });
    }

    return Response.json({ results, total, page, per_page: perPage });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
