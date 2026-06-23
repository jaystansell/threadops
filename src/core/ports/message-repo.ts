import type { Message, MessageId, MessageAuthorKind, MessageMetadata } from "../types";
import type { ThreadId } from "../types";

export interface MessageRepo {
  listByThread(threadId: ThreadId): Promise<Message[]>;
  getById(threadId: ThreadId, messageId: MessageId): Promise<Message | null>;
  create(input: MessageCreateInput): Promise<Message>;
}

export interface MessageCreateInput {
  thread_id: ThreadId;
  author_id: string;
  author_kind: MessageAuthorKind;
  author_name?: string | null;
  body: string;
  metadata?: MessageMetadata | null;
}
