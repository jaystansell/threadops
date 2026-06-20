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
    throw new Error("Thread not found or does not belong to your company");
  }

  const messageRepo = createMessageRepo(db);
  return messageRepo.create({
    thread_id: input.thread_id as ThreadId,
    author_id: auth.keyId,
    author_kind: "agent",
    author_name: auth.keyLabel,
    body: input.body.trim(),
  });
}
