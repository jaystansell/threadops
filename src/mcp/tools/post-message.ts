import { createThreadRepo } from "../../adapters/supabase/thread-repo";
import { createMessageRepo } from "../../adapters/supabase/message-repo";
import type { SupabaseClient } from "../../adapters/supabase/client";
import type { AuthContext } from "../auth";
import type { CompanyId, ThreadId } from "../../core/types";

export interface PostMessageInput {
  thread_id: string;
  body: string;
}

export async function postMessage(
  db: SupabaseClient,
  auth: AuthContext,
  input: PostMessageInput,
) {
  const threadRepo = createThreadRepo(db);
  const thread = await threadRepo.getById(
    auth.companyId as CompanyId,
    input.thread_id as ThreadId,
  );
  if (!thread) {
    throw new Error(
      `Thread not found (id: ${input.thread_id}). Verify the thread_id from the webhook payload or use manage_threads(action='list') to get your active thread IDs. Do not construct IDs manually.`,
    );
  }
  if (thread.agent_api_key_id && thread.agent_api_key_id !== auth.keyId) {
    throw new Error("This thread belongs to another agent");
  }

  // Auto-assign ownership: if thread has no owner, claim it for this agent.
  if (!thread.agent_api_key_id) {
    await db
      .from("threads")
      .update({ agent_api_key_id: auth.keyId })
      .eq("id", input.thread_id);
  }

  // Auto-complete processing status when agent responds
  await db.from("agent_processing_status").insert({
    thread_id: input.thread_id,
    api_key_id: auth.keyId,
    status: "completed",
  });

  const messageRepo = createMessageRepo(db);
  return messageRepo.create({
    thread_id: input.thread_id as ThreadId,
    author_id: auth.keyId,
    author_kind: "agent",
    author_name: auth.keyLabel,
    body: input.body.trim(),
  });
}
