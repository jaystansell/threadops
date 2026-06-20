import type { SupabaseClient } from "../../adapters/supabase/client";
import type { AuthContext } from "../auth";

export interface UpdateThreadMetadataInput {
  thread_id: string;
  set?: Record<string, unknown>;
  unset?: string[];
}

export async function updateThreadMetadata(
  db: SupabaseClient,
  auth: AuthContext,
  input: UpdateThreadMetadataInput,
) {
  // Verify thread ownership and get current metadata
  const { data: thread } = await db
    .from("threads")
    .select("id, metadata")
    .eq("id", input.thread_id)
    .eq("company_id", auth.companyId)
    .eq("agent_api_key_id", auth.keyId)
    .single();

  if (!thread) throw new Error("Thread not found");

  if (!input.set && (!input.unset || input.unset.length === 0)) {
    throw new Error("At least one of set or unset must be provided");
  }

  const currentMetadata = (thread.metadata as Record<string, unknown>) ?? {};
  const merged = { ...currentMetadata, ...(input.set ?? {}) };

  for (const key of input.unset ?? []) {
    delete merged[key];
  }

  const { data, error } = await db
    .from("threads")
    .update({ metadata: merged, updated_at: new Date().toISOString() })
    .eq("id", input.thread_id)
    .eq("company_id", auth.companyId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
