import type { Attachment, AttachmentId } from "../types";

export interface AttachmentRepo {
  listByMessage(messageId: string): Promise<Attachment[]>;
  getById(attachmentId: AttachmentId): Promise<Attachment | null>;
  create(input: AttachmentCreateInput): Promise<Attachment>;
  countByMessage(messageId: string): Promise<number>;
  countRecentByCompany(companyId: string, windowMinutes: number): Promise<number>;
  markPurged(ids: string[]): Promise<void>;
  listExpired(retentionDays: number, limit: number): Promise<Attachment[]>;
}

export interface AttachmentCreateInput {
  message_id: string;
  thread_id: string;
  company_id: string;
  filename: string;
  file_size: number;
  content_type: string;
  storage_path: string;
}
