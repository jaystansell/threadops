import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { resolveApiKey } from "@/adapters/supabase/api-key-auth";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/agents/capabilities/:actionType
 * Remove a capability by action_type name.
 * Auth: X-API-Key header (agent self-service).
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ actionType: string }> },
) {
  const { actionType } = await ctx.params;
  const auth = await resolveApiKey(req);
  if (auth.kind === "none" || auth.kind === "invalid") {
    return auth.kind === "none"
      ? Response.json({ error: "Invalid or missing API key" }, { status: 401 })
      : auth.response;
  }
  if (auth.kind === "rate_limited") return auth.response;

  const db = createServerClient();

  const { data: action } = await db
    .from("agent_actions")
    .select("id")
    .eq("api_key_id", auth.keyId)
    .eq("name", actionType)
    .single();

  if (!action) {
    return Response.json({ error: "Capability not found" }, { status: 404 });
  }

  const { error } = await db
    .from("agent_actions")
    .delete()
    .eq("id", action.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, deleted: actionType });
}
