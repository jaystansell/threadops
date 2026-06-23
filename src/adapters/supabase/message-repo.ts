import type { Message, MessageId, ThreadId } from "@/core/types";
import type { MessageRepo, MessageCreateInput } from "@/core/ports";
import type { SupabaseClient } from "./client";

export function createMessageRepo(db: SupabaseClient): MessageRepo {
  return {
    async listByThread(threadId: ThreadId): Promise<Message[]> {
      const { data, error } = await db
        .from("messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Message[];
    },

    async getById(
      threadId: ThreadId,
      messageId: MessageId,
    ): Promise<Message | null> {
      const { data, error } = await db
        .from("messages")
        .select("*")
        .eq("thread_id", threadId)
        .eq("id", messageId)
        .single();
      if (error && error.code === "PGRST116") return null;
      if (error) throw error;
      return data as Message;
    },

    async create(input: MessageCreateInput): Promise<Message> {
      const row: Record<string, unknown> = {
        thread_id: input.thread_id,
        author_id: input.author_id,
        author_kind: input.author_kind,
        body: input.body,
      };
      if (input.author_name != null) {
        row.author_name = input.author_name;
      }
      const { data, error } = await db
        .from("messages")
        .insert(row)
        .select()
        .single();
      if (error) throw error;

      // Best-effort: attach metadata if the column exists (migration 031)
      if (input.metadata != null) {
        const { data: updated } = await db
          .from("messages")
          .update({ metadata: input.metadata })
          .eq("id", (data as Message).id)
          .select()
          .single();
        if (updated) return updated as Message;
      }

      return data as Message;
    },
  };
}
