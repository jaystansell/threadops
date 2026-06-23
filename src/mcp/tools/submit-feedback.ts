import type { SupabaseClient } from "../../adapters/supabase/client";
import type { AuthContext } from "../auth";
import type { AgentFeedbackCategory, AgentFeedbackPriority } from "../../core/types";

export interface SubmitFeedbackInput {
  category: AgentFeedbackCategory;
  title: string;
  description: string;
  priority?: AgentFeedbackPriority;
}

export async function submitFeedback(
  db: SupabaseClient,
  auth: AuthContext,
  input: SubmitFeedbackInput,
) {
  const { data, error } = await db
    .from("agent_feedback")
    .insert({
      company_id: auth.companyId,
      api_key_id: auth.keyId,
      category: input.category,
      title: input.title.trim(),
      description: input.description.trim(),
      priority: input.priority ?? "medium",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
