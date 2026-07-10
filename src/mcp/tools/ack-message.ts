import type { SupabaseClient } from "../../adapters/supabase/client";
import type { AuthContext } from "../auth";
import type { CompanyId, ThreadId } from "../../core/types";

export type AckStatus = "acknowledged" | "processing" | "completed" | "escalated";

export interface AckMessageInput {
  thread_id: string;
  status: AckStatus;
  message_id?: string;
}

export async function ackMessage(
  db: SupabaseClient,
  auth: AuthContext,
  input: AckMessageInput,
) {
  const { data: thread, error: threadError } = await db
    .from("threads")
    .select("id")
    .eq("id", input.thread_id)
    .eq("company_id", auth.companyId as CompanyId)
    .single();
  if (threadError || !thread) {
    throw new Error("Thread not found");
  }

  const { data, error } = await db
    .from("agent_processing_status")
    .insert({
      thread_id: thread.id as ThreadId,
      api_key_id: auth.keyId,
      message_id: input.message_id ?? null,
      status: input.status,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
