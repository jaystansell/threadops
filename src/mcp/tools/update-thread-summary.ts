import type { SupabaseClient } from "../../adapters/supabase/client";
import type { AuthContext } from "../auth";

export interface UpdateThreadSummaryInput {
  thread_id: string;
  summary: string;
}

export async function updateThreadSummary(
  db: SupabaseClient,
  auth: AuthContext,
  input: UpdateThreadSummaryInput,
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

  const { data, error } = await db
    .from("threads")
    .update({ summary: input.summary, updated_at: new Date().toISOString() })
    .eq("id", input.thread_id)
    .eq("company_id", auth.companyId)
    .select()
    .single();

  if (error) throw error;

  // Append to summary log
  const { error: logError } = await db.from("thread_summaries").insert({
    thread_id: input.thread_id,
    summary: input.summary,
    author_kind: "agent",
    author_name: auth.keyLabel ?? null,
  });
  if (logError) {
    console.error("Failed to insert summary log entry:", logError.message);
  }

  return data;
}
