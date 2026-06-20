import type { SupabaseClient } from "../../adapters/supabase/client";
import type { AuthContext } from "../auth";

export interface SearchInput {
  query: string;
  scope?: "messages" | "threads" | "all";
  filters?: {
    status?: string;
    author_kind?: string;
    created_after?: string;
    created_before?: string;
  };
}

function highlightMatch(text: string, query: string): string {
  const words = query.split(/\s+/).filter(Boolean);
  let highlighted = text;
  for (const word of words) {
    const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    highlighted = highlighted.replace(regex, "**$1**");
  }
  const firstWordRegex = new RegExp(words[0]?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") ?? "", "i");
  const matchIndex = text.search(firstWordRegex);
  if (matchIndex > 50) {
    highlighted = "..." + highlighted.slice(Math.max(0, matchIndex - 50));
  }
  if (highlighted.length > 200) {
    highlighted = highlighted.slice(0, 200) + "...";
  }
  return highlighted;
}

export async function search(
  db: SupabaseClient,
  auth: AuthContext,
  input: SearchInput,
) {
  const scope = input.scope ?? "all";
  const query = input.query.trim();

  if (!query) throw new Error("query is required");

  const tsquery = query
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean)
    .join(" & ");

  if (!tsquery) return { results: [], total: 0 };

  const results: Array<{
    type: "thread" | "message";
    thread_id: string;
    thread_title?: string;
    message_id?: string;
    highlight: string;
    author_kind?: string;
    created_at: string;
  }> = [];

  if (scope === "threads" || scope === "all") {
    let threadQuery = db
      .from("threads")
      .select("id, title, status, created_at")
      .eq("company_id", auth.companyId)
      .eq("agent_api_key_id", auth.keyId)
      .textSearch("search_vector", tsquery)
      .order("created_at", { ascending: false })
      .limit(20);

    if (input.filters?.status) {
      threadQuery = threadQuery.eq("status", input.filters.status);
    }
    if (input.filters?.created_after) {
      threadQuery = threadQuery.gte("created_at", input.filters.created_after);
    }
    if (input.filters?.created_before) {
      threadQuery = threadQuery.lte("created_at", input.filters.created_before);
    }

    const { data, error } = await threadQuery;
    if (error) throw error;

    for (const thread of data ?? []) {
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
      .select("id, thread_id, body, author_kind, created_at, threads!inner(company_id, agent_api_key_id)")
      .eq("threads.company_id", auth.companyId)
      .eq("threads.agent_api_key_id", auth.keyId)
      .textSearch("search_vector", tsquery)
      .order("created_at", { ascending: false })
      .limit(20);

    if (input.filters?.author_kind) {
      msgQuery = msgQuery.eq("author_kind", input.filters.author_kind);
    }
    if (input.filters?.created_after) {
      msgQuery = msgQuery.gte("created_at", input.filters.created_after);
    }
    if (input.filters?.created_before) {
      msgQuery = msgQuery.lte("created_at", input.filters.created_before);
    }

    const { data, error } = await msgQuery;
    if (error) throw error;

    for (const msg of data ?? []) {
      results.push({
        type: "message",
        thread_id: msg.thread_id,
        message_id: msg.id,
        highlight: highlightMatch(msg.body ?? "", query),
        author_kind: msg.author_kind,
        created_at: msg.created_at,
      });
    }
  }

  results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return { results, total: results.length };
}
