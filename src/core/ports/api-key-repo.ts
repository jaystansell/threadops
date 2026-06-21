import type { ApiKey, ApiKeyId, ApiKeyCreateResult } from "../types";
import type { CompanyId } from "../types";

export interface ApiKeyRepo {
  create(input: ApiKeyCreateInput): Promise<ApiKeyCreateResult>;
  lookupByHash(keyHash: string): Promise<ApiKey | null>;
  revoke(companyId: CompanyId, keyId: ApiKeyId): Promise<void>;
  listByCompany(companyId: CompanyId): Promise<ApiKey[]>;
  listByUser(companyId: CompanyId, userId: string): Promise<ApiKey[]>;
  touchLastUsed(keyId: ApiKeyId): Promise<void>;
}

export interface ApiKeyCreateInput {
  company_id: CompanyId;
  created_by: string;
  label: string;
  scopes: string[];
}
