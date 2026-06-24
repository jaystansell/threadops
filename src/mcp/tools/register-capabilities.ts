import type { SupabaseClient } from "../../adapters/supabase/client";
import type { AuthContext } from "../auth";

interface RegisterCapabilitiesInput {
  capabilities: {
    action_type: string;
    description?: string;
    parameters_schema?: Record<string, unknown>;
  }[];
}

export async function registerCapabilities(
  db: SupabaseClient,
  auth: AuthContext,
  input: RegisterCapabilitiesInput,
) {
  const results = [];

  for (const cap of input.capabilities) {
    const { data, error } = await db
      .from("agent_actions")
      .upsert(
        {
          api_key_id: auth.keyId,
          company_id: auth.companyId,
          name: cap.action_type,
          description: cap.description ?? "",
          parameter_schema: cap.parameters_schema ?? {},
        },
        { onConflict: "api_key_id,name" },
      )
      .select()
      .single();

    if (error) {
      results.push({ action_type: cap.action_type, error: error.message });
    } else {
      results.push({
        id: data.id,
        action_type: data.name,
        description: data.description,
        parameters_schema: data.parameter_schema,
        created_at: data.created_at,
      });
    }
  }

  return { registered: results.length, capabilities: results };
}
