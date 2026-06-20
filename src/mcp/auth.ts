import { hashKey } from "../core/rules/api-key";
import { createApiKeyRepo } from "../adapters/supabase/api-key-repo";
import type { SupabaseClient } from "../adapters/supabase/client";
import type { ApiKey } from "../core/types";

export interface AuthContext {
  apiKey: ApiKey;
  companyId: string;
  keyLabel: string;
  keyId: string;
}

export async function authenticateApiKey(
  db: SupabaseClient,
  plaintextKey: string,
): Promise<AuthContext> {
  const apiKeyRepo = createApiKeyRepo(db);
  const keyHash = await hashKey(plaintextKey);
  const keyRecord = await apiKeyRepo.lookupByHash(keyHash);
  if (!keyRecord) {
    throw new Error("Invalid API key");
  }
  await apiKeyRepo.touchLastUsed(keyRecord.id);
  return {
    apiKey: keyRecord,
    companyId: keyRecord.company_id,
    keyLabel: keyRecord.label,
    keyId: keyRecord.id,
  };
}
