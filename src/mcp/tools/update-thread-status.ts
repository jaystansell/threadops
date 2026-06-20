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
  return threadRepo.updateStatus(
    auth.companyId as CompanyId,
    input.thread_id as ThreadId,
    input.status as ThreadStatus,
  );
}
