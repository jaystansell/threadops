import type { SupabaseClient } from "../../adapters/supabase/client";
import type { AuthContext } from "../auth";
import type { CompanyId, ThreadStatus } from "../../core/types";

const VALID_STATUSES: ThreadStatus[] = ["open", "archived"];

export interface ListThreadsInput {
  status?: string;
  q?: string;
  tags?: string[];
  metadata_filter?: Record<string, string>;
  limit?: number;
  offset?: number;
}

export async function listThreads(
  db: SupabaseClient,
  auth: AuthContext,
  input: ListThreadsInput,
) {
  const companyId = auth.companyId as CompanyId;
  const limit = Math.min(200, Math.max(1, input.limit ?? 100));
  const offset = Math.max(0, input.offset ?? 0);

  // If tags filter, resolve matching thread IDs first (scoped by company)
  let tagFilteredIds: string[] | null = null;
  if (input.tags && input.tags.length > 0) {
    const normalizedTags = input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (normalizedTags.length > 0) {
      const { data: tagRows } = await db
        .from("thread_tags")
        .select("thread_id, tag, threads!inner(company_id)")
        .eq("threads.company_id", companyId)
        .in("tag", normalizedTags);

      const threadTagCounts = new Map<string, number>();
      for (const row of tagRows ?? []) {
        threadTagCounts.set(row.thread_id, (threadTagCounts.get(row.thread_id) ?? 0) + 1);
      }
      tagFilteredIds = [];
      for (const [tid, count] of threadTagCounts) {
        if (count >= normalizedTags.length) {
          tagFilteredIds.push(tid);
        }
      }
      if (tagFilteredIds.length === 0) return [];
    }
  }

  let query = db
    .from("threads")
    .select("*")
    .eq("company_id", companyId)
    .eq("agent_api_key_id", auth.keyId)
    .order("created_at", { ascending: false });

  if (input.status && VALID_STATUSES.includes(input.status as ThreadStatus)) {
    query = query.eq("status", input.status);
  }
  if (input.q) {
    const escaped = input.q.replace(/[%_\\]/g, "\\$&");
    query = query.ilike("title", `%${escaped}%`);
  }
  if (tagFilteredIds) {
    query = query.in("id", tagFilteredIds);
  }

  // Metadata filtering
  if (input.metadata_filter) {
    for (const [key, value] of Object.entries(input.metadata_filter)) {
      query = query.eq(`metadata->>${key}`, value);
    }
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw error;

  // Fetch tags for results
  const threadIds = (data ?? []).map((t: { id: string }) => t.id);
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

  return (data ?? []).map((thread: { id: string }) => ({
    ...thread,
    tags: tagMap.get(thread.id) ?? [],
  }));
}
