import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { hashKey } from "@/core/rules/api-key";
import { checkRateLimit, rateLimitResponse } from "@/core/rules/rate-limit";

export type ApiKeyResult =
  | { kind: "none" }
  | { kind: "invalid"; response: Response }
  | { kind: "rate_limited"; response: Response }
  | { kind: "ok"; companyId: string; keyLabel: string; keyId: string };

/**
 * Resolve an API key from the request, validate it, and enforce rate limits.
 *
 * Returns `{ kind: "ok", ... }` when the key is valid and under limit.
 * For "invalid" and "rate_limited", a pre-built Response is included.
 * Returns `{ kind: "none" }` if no API key header is present.
 */
export async function resolveApiKey(req: NextRequest): Promise<ApiKeyResult> {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return { kind: "none" };

  const db = createServerClient();
  const apiKeyRepo = createApiKeyRepo(db);
  const keyHash = await hashKey(apiKey);
  const keyRecord = await apiKeyRepo.lookupByHash(keyHash);

  if (!keyRecord) {
    return {
      kind: "invalid",
      response: Response.json({ error: "Invalid API key" }, { status: 401 }),
    };
  }

  // Rate limit by key hash (60 req/min per key)
  const limit = checkRateLimit(keyHash);
  if (!limit.allowed) {
    return {
      kind: "rate_limited",
      response: rateLimitResponse(limit.retryAfterMs!),
    };
  }

  await apiKeyRepo.touchLastUsed(keyRecord.id);

  return {
    kind: "ok",
    companyId: keyRecord.company_id,
    keyLabel: keyRecord.label,
    keyId: keyRecord.id,
  };
}
