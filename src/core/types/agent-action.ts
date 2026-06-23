import type { ApiKeyId } from "./api-key";
import type { CompanyId } from "./company";

export type AgentActionId = string & { readonly __brand: "AgentActionId" };

export interface AgentAction {
  id: AgentActionId;
  api_key_id: ApiKeyId;
  company_id: CompanyId;
  name: string;
  description: string;
  parameter_schema: Record<string, unknown>;
  created_at: string;
}
