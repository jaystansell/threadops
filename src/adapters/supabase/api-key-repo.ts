import type { SupabaseClient } from "./client";
import type { ApiKey, ApiKeyId, ApiKeyCreateResult, CompanyId } from "@/core/types";
import type { ApiKeyRepo, ApiKeyCreateInput } from "@/core/ports";
import {
  generatePlaintextKey,
  extractPrefix,
  hashKey,
} from "@/core/rules/api-key";

export function createApiKeyRepo(db: SupabaseClient): ApiKeyRepo {
  return {
    async create(input: ApiKeyCreateInput): Promise<ApiKeyCreateResult> {
      const plaintext = generatePlaintextKey();
      const prefix = extractPrefix(plaintext);
      const hash = await hashKey(plaintext);

      const { data, error } = await db
        .from("api_keys")
        .insert({
          company_id: input.company_id,
          label: input.label,
          key_hash: hash,
          key_prefix: prefix,
          scopes: input.scopes,
        })
        .select("id")
        .single();
      if (error) throw error;

      return {
        id: data.id as ApiKeyId,
        plaintext_key: plaintext,
        key_prefix: prefix,
      };
    },

    async lookupByHash(keyHash: string): Promise<ApiKey | null> {
      const { data, error } = await db
        .from("api_keys")
        .select("*")
        .eq("key_hash", keyHash)
        .is("revoked_at", null)
        .single();
      if (error && error.code === "PGRST116") return null;
      if (error) throw error;
      return data as ApiKey;
    },

    async revoke(companyId: CompanyId, keyId: ApiKeyId): Promise<void> {
      const { error } = await db
        .from("api_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("company_id", companyId)
        .eq("id", keyId);
      if (error) throw error;
    },

    async listByCompany(companyId: CompanyId): Promise<ApiKey[]> {
      const { data, error } = await db
        .from("api_keys")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ApiKey[];
    },

    async touchLastUsed(keyId: ApiKeyId): Promise<void> {
      const { error } = await db
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", keyId);
      if (error) throw error;
    },
  };
}
