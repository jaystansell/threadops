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
    throw new Error("Thread not found or does not belong to your company");
  }

  const messageRepo = createMessageRepo(db);
  return messageRepo.listByThread(input.thread_id as ThreadId);
}
