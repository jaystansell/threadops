import { createThreadRepo } from "../../adapters/supabase/thread-repo";
import { createMessageRepo } from "../../adapters/supabase/message-repo";
import type { SupabaseClient } from "../../adapters/supabase/client";
import type { AuthContext } from "../auth";
import type { CompanyId, ThreadId } from "../../core/types";

export interface GetMessagesInput {
  thread_id: string;
}

export async function getMessages(
  db: SupabaseClient,
  auth: AuthContext,
  input: GetMessagesInput,
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

  const messageRepo = createMessageRepo(db);
  return messageRepo.listByThread(input.thread_id as ThreadId);
}
