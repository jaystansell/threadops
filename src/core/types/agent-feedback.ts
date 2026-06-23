import type { CompanyId } from "./company";
import type { ApiKeyId } from "./api-key";

export type AgentFeedbackId = string & { readonly __brand: "AgentFeedbackId" };

export type AgentFeedbackCategory =
  | "webhook_filter"
  | "api_feature"
  | "payload_field"
  | "bug_report"
  | "general";

export type AgentFeedbackPriority = "high" | "medium" | "low";

export type AgentFeedbackStatus = "pending" | "approved" | "rejected" | "shipped";

export interface AgentFeedback {
  id: AgentFeedbackId;
  company_id: CompanyId;
  api_key_id: ApiKeyId;
  category: AgentFeedbackCategory;
  title: string;
  description: string;
  priority: AgentFeedbackPriority;
  status: AgentFeedbackStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}
