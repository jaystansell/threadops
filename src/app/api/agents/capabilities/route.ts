import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { resolveApiKey } from "@/adapters/supabase/api-key-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/agents/capabilities
 * Register or update a capability (action) the calling agent supports.
 * Auth: X-API-Key header (agent self-service — no apiKeyId in URL).
 *
 * Body: { action_type, description?, parameters_schema? }
 */
export async function POST(req: NextRequest) {
  const auth = await resolveApiKey(req);
  if (auth.kind === "none" || auth.kind === "invalid") {
    return auth.kind === "none"
      ? Response.json({ error: "Invalid or missing API key" }, { status: 401 })
      : auth.response;
  }
  if (auth.kind === "rate_limited") return auth.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.action_type !== "string" || !body.action_type.trim()) {
    return Response.json(
      { error: "Body must include 'action_type' as a non-empty string" },
      { status: 400 },
    );
  }

  const name = body.action_type.trim();
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const parameterSchema =
    body.parameters_schema && typeof body.parameters_schema === "object"
      ? body.parameters_schema
      : {};

  const db = createServerClient();

  const { data, error } = await db
    .from("agent_actions")
    .upsert(
      {
        api_key_id: auth.keyId,
        company_id: auth.companyId,
        name,
        description,
        parameter_schema: parameterSchema,
      },
      { onConflict: "api_key_id,name" },
    )
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(
    {
      id: data.id,
      action_type: data.name,
      description: data.description,
      parameters_schema: data.parameter_schema,
      created_at: data.created_at,
    },
    { status: 201 },
  );
}

/**
 * GET /api/agents/capabilities
 * List all capabilities declared by the calling agent.
 * Auth: X-API-Key header.
 */
export async function GET(req: NextRequest) {
  const auth = await resolveApiKey(req);
  if (auth.kind === "none" || auth.kind === "invalid") {
    return auth.kind === "none"
      ? Response.json({ error: "Invalid or missing API key" }, { status: 401 })
      : auth.response;
  }
  if (auth.kind === "rate_limited") return auth.response;

  const db = createServerClient();

  const { data, error } = await db
    .from("agent_actions")
    .select("id, name, description, parameter_schema, created_at")
    .eq("api_key_id", auth.keyId)
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(
    (data ?? []).map(
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
    ),
  );
}
