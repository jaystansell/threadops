import type { Thread, ThreadId, ThreadStatus, CompanyId } from "@/core/types";
import type {
  ThreadRepo,
  ThreadFilters,
  ThreadCreateInput,
} from "@/core/ports";
import type { SupabaseClient } from "./client";

export function createThreadRepo(db: SupabaseClient): ThreadRepo {
  return {
    async list(companyId: CompanyId, filters?: ThreadFilters): Promise<Thread[]> {
      let query = db
        .from("threads")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (filters?.theme_id) {
        query = query.eq("theme_id", filters.theme_id);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Thread[];
    },

    async getById(
      companyId: CompanyId,
      threadId: ThreadId,
    ): Promise<Thread | null> {
      const { data, error } = await db
        .from("threads")
        .select("*")
        .eq("company_id", companyId)
        .eq("id", threadId)
        .single();
      if (error && error.code === "PGRST116") return null;
      if (error) throw error;
      return data as Thread;
    },

    async create(input: ThreadCreateInput): Promise<Thread> {
      const { data, error } = await db
        .from("threads")
        .insert({
          company_id: input.company_id,
          theme_id: input.theme_id ?? null,
          title: input.title,
          created_by: input.created_by,
          agent_api_key_id: input.agent_api_key_id ?? null,
          status: "open" as ThreadStatus,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Thread;
    },

    async updateStatus(
      companyId: CompanyId,
      threadId: ThreadId,
      status: ThreadStatus,
    ): Promise<Thread> {
      const { data, error } = await db
        .from("threads")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("company_id", companyId)
        .eq("id", threadId)
        .select()
        .single();
      if (error) throw error;
      return data as Thread;
    },
  };
}
