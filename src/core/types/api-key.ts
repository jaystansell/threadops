import type { CompanyId } from "./company";

export type ApiKeyId = string & { readonly __brand: "ApiKeyId" };

export interface ApiKey {
  id: ApiKeyId;
  company_id: CompanyId;
  label: string;
  key_hash: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface ApiKeyCreateResult {
  id: ApiKeyId;
  plaintext_key: string;
  key_prefix: string;
}
