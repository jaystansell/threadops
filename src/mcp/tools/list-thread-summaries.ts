import type { SupabaseClient } from "../../adapters/supabase/client";
import type { AuthContext } from "../auth";

export interface ListThreadSummariesInput {
  thread_id: string;
  limit?: number;
}

export async function listThreadSummaries(
  db: SupabaseClient,
  auth: AuthContext,
  input: ListThreadSummariesInput,
) {
  // Verify thread ownership
  const { data: thread } = await db
    .from("threads")
    .select("id")
    .eq("id", input.thread_id)
    .eq("company_id", auth.companyId)
    .eq("agent_api_key_id", auth.keyId)
    .single();

  if (!thread) throw new Error("Thread not found");

  const maxRows = input.limit ?? 50;

  const { data, error } = await db
    .from("thread_summaries")
    .select("id, summary, author_kind, author_name, created_at")
    .eq("thread_id", input.thread_id)
    .order("created_at", { ascending: false })
    .limit(maxRows);

  if (error) throw error;
  return { thread_id: input.thread_id, summaries: data ?? [] };
}
