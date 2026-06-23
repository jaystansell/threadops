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

/**
 * Authenticate a Bearer token.
 *
 * Accepts two token formats:
 *  - Direct API key (prefix `to_`)  → validated via api_keys table
 *  - OAuth access token (`to_at_`)  → resolved via oauth_access_tokens → api_keys
 */
export async function authenticateApiKey(
  db: SupabaseClient,
  plaintextKey: string,
): Promise<AuthContext> {
  if (plaintextKey.startsWith("to_at_")) {
    return authenticateOAuthToken(db, plaintextKey);
  }

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

async function authenticateOAuthToken(
  db: SupabaseClient,
  token: string,
): Promise<AuthContext> {
  const tokenHash = await hashKey(token);

  const rl = checkRateLimit(tokenHash);
  if (!rl.allowed) {
    throw new RateLimitError(rl.retryAfterMs!);
  }

  const { data: tokenRecord, error } = await db
    .from("oauth_access_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .single();

  if (error || !tokenRecord) {
    throw new Error("Invalid access token");
  }

  if (new Date(tokenRecord.expires_at) < new Date()) {
    throw new Error("Access token expired");
  }

  // Look up the linked API key
  const apiKeyRepo = createApiKeyRepo(db);
  const { data: keyRecord } = await db
    .from("api_keys")
    .select("*")
    .eq("id", tokenRecord.api_key_id)
    .is("revoked_at", null)
    .single();

  if (!keyRecord) {
    throw new Error("Linked API key revoked or deleted");
  }

  await apiKeyRepo.touchLastUsed(keyRecord.id);

  return {
    apiKey: keyRecord as ApiKey,
    companyId: keyRecord.company_id,
    keyLabel: keyRecord.label,
    keyId: keyRecord.id,
  };
}
