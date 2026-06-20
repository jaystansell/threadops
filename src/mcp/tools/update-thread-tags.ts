import type { SupabaseClient } from "../../adapters/supabase/client";
import type { AuthContext } from "../auth";

export interface UpdateThreadTagsInput {
  thread_id: string;
  add?: string[];
  remove?: string[];
}

export async function updateThreadTags(
  db: SupabaseClient,
  auth: AuthContext,
  input: UpdateThreadTagsInput,
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

  const addTags = (input.add ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean);
  const removeTags = (input.remove ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean);

  if (addTags.length === 0 && removeTags.length === 0) {
    throw new Error("At least one of add or remove must be provided");
  }

  // Add tags
  if (addTags.length > 0) {
    const rows = addTags.map((tag) => ({ thread_id: input.thread_id, tag }));
    const { error: addError } = await db
      .from("thread_tags")
      .upsert(rows, { onConflict: "thread_id,tag" });
    if (addError) throw addError;
  }

  // Remove tags
  if (removeTags.length > 0) {
    const { error: removeError } = await db
      .from("thread_tags")
      .delete()
      .eq("thread_id", input.thread_id)
      .in("tag", removeTags);
    if (removeError) throw removeError;
  }

  // Return current tags
  const { data: currentTags, error } = await db
    .from("thread_tags")
    .select("tag")
    .eq("thread_id", input.thread_id)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return {
    thread_id: input.thread_id,
    tags: (currentTags ?? []).map((t: { tag: string }) => t.tag),
  };
}
