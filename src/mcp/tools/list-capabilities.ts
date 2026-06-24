import type { SupabaseClient } from "../../adapters/supabase/client";
import type { AuthContext } from "../auth";

export async function listCapabilities(
  db: SupabaseClient,
  auth: AuthContext,
) {
  const { data, error } = await db
    .from("agent_actions")
    .select("id, name, description, parameter_schema, created_at")
    .eq("api_key_id", auth.keyId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(
    (row: {
      id: string;
      name: string;
      description: string;
      parameter_schema: unknown;
      created_at: string;
    }) => ({
      id: row.id,
      action_type: row.name,
      description: row.description,
      parameters_schema: row.parameter_schema,
      created_at: row.created_at,
    }),
  );
}
