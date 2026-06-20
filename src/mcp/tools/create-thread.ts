import { createThreadRepo } from "../../adapters/supabase/thread-repo";
import { createMessageRepo } from "../../adapters/supabase/message-repo";
import type { SupabaseClient } from "../../adapters/supabase/client";
import type { AuthContext } from "../auth";
import type { CompanyId, ThreadId } from "../../core/types";

export interface CreateThreadInput {
  title: string;
  message_body: string;
}

export async function createThread(
  db: SupabaseClient,
  auth: AuthContext,
  input: CreateThreadInput,
) {
  const threadRepo = createThreadRepo(db);
  const messageRepo = createMessageRepo(db);

  const thread = await threadRepo.create({
    company_id: auth.companyId as CompanyId,
    title: input.title.trim(),
    created_by: auth.keyId,
  });

  const message = await messageRepo.create({
    thread_id: thread.id as ThreadId,
    author_id: auth.keyId,
    author_kind: "agent",
    author_name: auth.keyLabel,
    body: input.message_body.trim(),
  });

  return { thread, message };
}
