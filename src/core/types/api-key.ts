import type { CompanyId } from "./company";

export type ApiKeyId = string & { readonly __brand: "ApiKeyId" };

export interface ApiKey {
  id: ApiKeyId;
  company_id: CompanyId;
  created_by: string | null;
  label: string;
  key_hash: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
  detected_model: string | null;
  model_tier: string | null;
}

export interface ApiKeyCreateResult {
  id: ApiKeyId;
  plaintext_key: string;
  key_prefix: string;
}
