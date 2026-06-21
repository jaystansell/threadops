import type { ApiKeyId, CompanyId } from "@/core/types";
import { type ModelTier, DEFAULT_TIER, detectModelTier } from "@/core/config/model-pricing";
import type { SupabaseClient } from "./client";

export interface UsageLogInput {
  apiKeyId: ApiKeyId;
  companyId: CompanyId;
  threadId: string;
  messageCount: number;
  modelTier?: ModelTier;
}

export interface SavingsSummary {
  totalQueries: number;
  totalTokensWithout: number;
  totalTokensWith: number;
  totalTokensSaved: number;
  firstLogAt: string | null;
}

export interface PerKeySavings extends SavingsSummary {
  apiKeyId: string;
  label: string;
  modelTier: string;
}

export function createUsageLogRepo(db: SupabaseClient) {
  return {
    async log(input: UsageLogInput): Promise<void> {
      const tier = input.modelTier ?? DEFAULT_TIER;
      const { error } = await db.from("usage_logs").insert({
        api_key_id: input.apiKeyId,
        company_id: input.companyId,
        thread_id: input.threadId,
        message_count: input.messageCount,
        model_tier: tier,
      });
      if (error) {
        console.error("Failed to log usage:", error.message);
      }
    },

    async getCompanySavings(companyId: CompanyId): Promise<SavingsSummary> {
      const { data, error } = await db
        .from("usage_logs")
        .select("message_count, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const rows = data ?? [];
      if (rows.length === 0) {
        return {
          totalQueries: 0,
          totalTokensWithout: 0,
          totalTokensWith: 0,
          totalTokensSaved: 0,
          firstLogAt: null,
        };
      }

      let totalTokensWithout = 0;
      let totalTokensWith = 0;
      for (const row of rows) {
        totalTokensWithout += row.message_count * 500;
        totalTokensWith += 500;
      }

      return {
        totalQueries: rows.length,
        totalTokensWithout,
        totalTokensWith,
        totalTokensSaved: totalTokensWithout - totalTokensWith,
        firstLogAt: rows[0].created_at as string,
      };
    },

    async getPerKeySavings(companyId: CompanyId): Promise<PerKeySavings[]> {
      const { data, error } = await db.rpc("get_per_key_savings", {
        p_company_id: companyId,
      });
      if (error) {
        // Fallback: manual aggregation if RPC not available
        const { data: logs, error: logErr } = await db
          .from("usage_logs")
          .select("api_key_id, message_count, model_tier")
          .eq("company_id", companyId);
        if (logErr) throw logErr;

        const { data: keys, error: keyErr } = await db
          .from("api_keys")
          .select("id, label, model_tier")
          .eq("company_id", companyId);
        if (keyErr) throw keyErr;

        const keyMap = new Map<string, { label: string; modelTier: string }>();
        for (const k of keys ?? []) {
          keyMap.set(k.id, { label: k.label, modelTier: k.model_tier ?? DEFAULT_TIER });
        }

        const agg = new Map<string, PerKeySavings>();
        for (const log of logs ?? []) {
          const keyId = log.api_key_id as string;
          const existing = agg.get(keyId) ?? {
            apiKeyId: keyId,
            label: keyMap.get(keyId)?.label ?? "Unknown",
            modelTier: keyMap.get(keyId)?.modelTier ?? DEFAULT_TIER,
            totalQueries: 0,
            totalTokensWithout: 0,
            totalTokensWith: 0,
            totalTokensSaved: 0,
            firstLogAt: null,
          };
          existing.totalQueries += 1;
          existing.totalTokensWithout += (log.message_count as number) * 500;
          existing.totalTokensWith += 500;
          existing.totalTokensSaved = existing.totalTokensWithout - existing.totalTokensWith;
          agg.set(keyId, existing);
        }

        return Array.from(agg.values());
      }

      return (data ?? []).map((row: Record<string, unknown>) => ({
        apiKeyId: row.api_key_id as string,
        label: row.label as string,
        modelTier: (row.model_tier as string) ?? DEFAULT_TIER,
        totalQueries: row.total_queries as number,
        totalTokensWithout: row.total_tokens_without as number,
        totalTokensWith: row.total_tokens_with as number,
        totalTokensSaved: row.total_tokens_saved as number,
        firstLogAt: row.first_log_at as string | null,
      }));
    },
  };
}

/**
 * Fire-and-forget usage logging. Called after a thread read is served.
 * Detects model from User-Agent if not already stored on the key.
 */
export async function logThreadRead(
  db: SupabaseClient,
  opts: {
    apiKeyId: ApiKeyId;
    companyId: CompanyId;
    threadId: string;
    messageCount: number;
    userAgent: string | null;
    storedModelTier: string | null;
  },
): Promise<void> {
  const repo = createUsageLogRepo(db);

  let tier = (opts.storedModelTier as ModelTier) ?? null;

  // Auto-detect from User-Agent if not already stored
  if (!tier) {
    const detected = detectModelTier(opts.userAgent);
    tier = detected ?? DEFAULT_TIER;

    // Persist detected model on the api_key for future use
    if (detected) {
      const { error } = await db
        .from("api_keys")
        .update({ detected_model: opts.userAgent, model_tier: tier })
        .eq("id", opts.apiKeyId);
      if (error) {
        console.error("Failed to update detected model:", error.message);
      }
    }
  }

  await repo.log({
    apiKeyId: opts.apiKeyId,
    companyId: opts.companyId as CompanyId,
    threadId: opts.threadId,
    messageCount: opts.messageCount,
    modelTier: tier,
  });
}
