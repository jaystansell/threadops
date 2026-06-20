import { createThreadRepo } from "../../adapters/supabase/thread-repo";
import { createMessageRepo } from "../../adapters/supabase/message-repo";
import type { SupabaseClient } from "../../adapters/supabase/client";
import type { AuthContext } from "../auth";
import type { CompanyId, ThreadId } from "../../core/types";

export interface CreateThreadInput {
  title: string;
  message_body: string;
  tags?: string[];
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
    agent_api_key_id: auth.keyId,
  });

  const message = await messageRepo.create({
    thread_id: thread.id as ThreadId,
    author_id: auth.keyId,
    author_kind: "agent",
    author_name: auth.keyLabel,
    body: input.message_body.trim(),
  });

  // Add tags if provided
  let tags: string[] = [];
  if (input.tags && input.tags.length > 0) {
    const normalizedTags = input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (normalizedTags.length > 0) {
      const rows = normalizedTags.map((tag) => ({ thread_id: thread.id, tag }));
      const { error: tagError } = await db.from("thread_tags").upsert(rows, { onConflict: "thread_id,tag" });
      if (tagError) throw new Error(`Failed to add tags: ${tagError.message}`);
      tags = normalizedTags;
    }
  }

  return { thread: { ...thread, tags }, message };
}
