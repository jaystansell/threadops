import type { ThreadId } from "./thread";

export type MessageId = string & { readonly __brand: "MessageId" };

export type MessageAuthorKind = "user" | "agent" | "action";

export interface MessageMetadata {
  source: "api" | "browser";
  endpoint: string;
  api_key_prefix?: string;
  agent_label?: string;
  thread_id: string;
}

export interface Message {
  id: MessageId;
  thread_id: ThreadId;
  author_id: string;
  author_kind: MessageAuthorKind;
  author_name: string | null;
  body: string;
  metadata: MessageMetadata | null;
  created_at: string;
  updated_at: string;
}
