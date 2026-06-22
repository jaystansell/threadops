import { hashKey } from "../core/rules/api-key";
import { checkRateLimit } from "../core/rules/rate-limit";
import { createApiKeyRepo } from "../adapters/supabase/api-key-repo";
import type { SupabaseClient } from "../adapters/supabase/client";
import type { ApiKey } from "../core/types";

export class RateLimitError extends Error {
  retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super("Rate limit exceeded");
    this.retryAfterMs = retryAfterMs;
  }
}

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
  const rl = checkRateLimit(keyHash);
  if (!rl.allowed) {
    throw new RateLimitError(rl.retryAfterMs!);
  }
  await apiKeyRepo.touchLastUsed(keyRecord.id);
  return {
    apiKey: keyRecord,
    companyId: keyRecord.company_id,
    keyLabel: keyRecord.label,
    keyId: keyRecord.id,
  };
}
