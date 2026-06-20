import type { Message } from "../types";
import type { ThreadId } from "../types";

export interface RealtimeAdapter {
  subscribeToThread(
    threadId: ThreadId,
    onMessage: (message: Message) => void,
  ): Subscription;
}

export interface Subscription {
  unsubscribe(): void;
}
