import { createThreadRepo } from "../../adapters/supabase/thread-repo";
import type { SupabaseClient } from "../../adapters/supabase/client";
import type { AuthContext } from "../auth";
import type { CompanyId, ThreadId, ThreadStatus } from "../../core/types";

export interface UpdateThreadStatusInput {
  thread_id: string;
  status: string;
}

export async function updateThreadStatus(
  db: SupabaseClient,
  auth: AuthContext,
  input: UpdateThreadStatusInput,
) {
  const threadRepo = createThreadRepo(db);
  const thread = await threadRepo.getById(
    auth.companyId as CompanyId,
    input.thread_id as ThreadId,
  );
  if (!thread) {
    throw new Error("Thread not found or does not belong to your company");
  }
  if (thread.agent_api_key_id && thread.agent_api_key_id !== auth.keyId) {
    throw new Error("This thread belongs to another agent");
  }
  return threadRepo.updateStatus(
    auth.companyId as CompanyId,
    input.thread_id as ThreadId,
    input.status as ThreadStatus,
  );
}
