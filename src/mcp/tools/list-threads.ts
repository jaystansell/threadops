import type { SupabaseClient } from "../../adapters/supabase/client";
import type { AuthContext } from "../auth";
import type { CompanyId, ThreadStatus } from "../../core/types";

const VALID_STATUSES: ThreadStatus[] = ["open", "closed", "archived"];

export interface ListThreadsInput {
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export async function listThreads(
  db: SupabaseClient,
  auth: AuthContext,
  input: ListThreadsInput,
) {
  const companyId = auth.companyId as CompanyId;
  const limit = Math.min(200, Math.max(1, input.limit ?? 100));
  const offset = Math.max(0, input.offset ?? 0);

  let query = db
    .from("threads")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (input.status && VALID_STATUSES.includes(input.status as ThreadStatus)) {
    query = query.eq("status", input.status);
  }
  if (input.q) {
    const escaped = input.q.replace(/[%_\\]/g, "\\$&");
    query = query.ilike("title", `%${escaped}%`);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
