import type { ThreadId } from "./thread";

export type MessageId = string & { readonly __brand: "MessageId" };

export type MessageAuthorKind = "user" | "agent";

export interface Message {
  id: MessageId;
  thread_id: ThreadId;
  author_id: string;
  author_kind: MessageAuthorKind;
  author_name: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}
