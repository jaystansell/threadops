import type { CompanyId } from "./company";

export type AgentId = string & { readonly __brand: "AgentId" };

export interface Agent {
  id: AgentId;
  company_id: CompanyId;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
