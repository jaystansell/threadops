import type { SupabaseClient } from "./client";
import type { Message, ThreadId } from "@/core/types";
import type { RealtimeAdapter, Subscription } from "@/core/ports";

export function createRealtimeAdapter(db: SupabaseClient): RealtimeAdapter {
  return {
    subscribeToThread(
      threadId: ThreadId,
      onMessage: (message: Message) => void,
    ): Subscription {
      const channel = db
        .channel(`thread:${threadId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `thread_id=eq.${threadId}`,
          },
          (payload) => {
            onMessage(payload.new as Message);
          },
        )
        .subscribe();

      return {
        unsubscribe() {
          db.removeChannel(channel);
        },
      };
    },
  };
}
