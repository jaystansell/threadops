import type { Attachment, AttachmentId } from "@/core/types";
import type { AttachmentRepo, AttachmentCreateInput } from "@/core/ports";
import type { SupabaseClient } from "./client";

export function createAttachmentRepo(db: SupabaseClient): AttachmentRepo {
  return {
    async listByMessage(messageId: string): Promise<Attachment[]> {
      const { data, error } = await db
        .from("message_attachments")
        .select("*")
        .eq("message_id", messageId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Attachment[];
    },

    async getById(attachmentId: AttachmentId): Promise<Attachment | null> {
      const { data, error } = await db
        .from("message_attachments")
        .select("*")
        .eq("id", attachmentId)
        .single();
      if (error && error.code === "PGRST116") return null;
      if (error) throw error;
      return data as Attachment;
    },

    async create(input: AttachmentCreateInput): Promise<Attachment> {
      const { data, error } = await db
        .from("message_attachments")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as Attachment;
    },

    async countByMessage(messageId: string): Promise<number> {
      const { count, error } = await db
        .from("message_attachments")
        .select("*", { count: "exact", head: true })
        .eq("message_id", messageId);
      if (error) throw error;
      return count ?? 0;
    },

    async countRecentByCompany(
      companyId: string,
      windowMinutes: number,
    ): Promise<number> {
      const since = new Date(
        Date.now() - windowMinutes * 60 * 1000,
      ).toISOString();
      const { count, error } = await db
        .from("message_attachments")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .gte("created_at", since);
      if (error) throw error;
      return count ?? 0;
    },

    async markPurged(ids: string[]): Promise<void> {
      const { error } = await db
        .from("message_attachments")
        .update({ purged_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },

    async listExpired(
      retentionDays: number,
      limit: number,
    ): Promise<Attachment[]> {
      const cutoff = new Date(
        Date.now() - retentionDays * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { data, error } = await db
        .from("message_attachments")
        .select("*")
        .lt("created_at", cutoff)
        .is("purged_at", null)
        .limit(limit);
      if (error) throw error;
      return data as Attachment[];
    },
  };
}
