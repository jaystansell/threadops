import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { dispatchOutboundWebhooks } from "@/adapters/supabase/outbound-webhook";
import { validateJsonSchema } from "@/core/rules/json-schema";
import type { CompanyId } from "@/core/types";

export const dynamic = "force-dynamic";

/** Built-in actions that are always available (backward compat). */
const BUILTIN_ACTIONS = new Set(["generate_summary", "generate_tags"]);

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await props.params;

  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const action = body.action as string;

  if (!action || typeof action !== "string") {
    return Response.json({ error: "'action' is required" }, { status: 400 });
  }

  const db = createServerClient();
  const { data: thread } = await db
    .from("threads")
    .select("company_id, agent_api_key_id, title, summary, status")
    .eq("id", threadId)
    .eq("company_id", userCompany.companyId)
    .single();

  if (!thread) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  if (!thread.agent_api_key_id) {
    return Response.json(
      { error: "This thread has no owning agent to handle the action" },
      { status: 422 },
    );
  }

  // For non-builtin actions, look up the agent's declared action and validate params
  let validatedParameters: Record<string, unknown> | undefined;

  if (!BUILTIN_ACTIONS.has(action)) {
    const { data: agentAction } = await db
      .from("agent_actions")
      .select("id, name, parameter_schema")
      .eq("api_key_id", thread.agent_api_key_id)
      .eq("name", action)
      .single();

    if (!agentAction) {
      // Fetch supported actions to include in the error
      const { data: allActions } = await db
        .from("agent_actions")
        .select("name")
        .eq("api_key_id", thread.agent_api_key_id!);
      const supported = [
        ...BUILTIN_ACTIONS,
        ...(allActions ?? []).map((a: { name: string }) => a.name),
      ];

      // Post an error message to the thread so the user sees it inline
      await db.from("messages").insert({
        thread_id: threadId,
        author_id: userCompany.userId,
        author_kind: "action",
        author_name: null,
        body: JSON.stringify({
          action_type: action,
          error: `Agent does not support action: ${action}. Supported actions: ${supported.join(", ")}`,
        }),
      });

      return Response.json(
        {
          error: `Agent does not support action: ${action}. Supported actions: ${supported.join(", ")}`,
        },
        { status: 422 },
      );
    }

    // Validate parameters against the declared schema
    const params = body.parameters ?? {};
    const schema = agentAction.parameter_schema as Record<string, unknown>;

    if (schema && Object.keys(schema).length > 0) {
      const result = validateJsonSchema(params, schema);
      if (!result.valid) {
        return Response.json(
          {
            error: "Parameter validation failed",
            validation_errors: result.errors,
          },
          { status: 400 },
        );
      }
    }

    validatedParameters = params;
  }

  const parameters = validatedParameters ?? (body.parameters || {});

  // Post an action message to the thread
  await db.from("messages").insert({
    thread_id: threadId,
    author_id: userCompany.userId,
    author_kind: "action",
    author_name: null,
    body: JSON.stringify({
      action_type: action,
      parameters,
      requested_by: "user",
      requested_at: new Date().toISOString(),
    }),
  });

  dispatchOutboundWebhooks(
    thread.company_id as CompanyId,
    "action.requested",
    {
      action: action,
      action_type: action,
      parameters,
      thread_id: threadId,
      thread_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://threadzy.ai"}/threads/${threadId}`,
      reply_endpoint: `POST /api/threads/${threadId}/messages`,
      thread_title: thread.title,
      current_summary: thread.summary ?? null,
      requested_by: "user",
      requested_at: new Date().toISOString(),
    },
    thread.agent_api_key_id,
  );

  return Response.json({ ok: true, action, thread_id: threadId });
}

/**
 * GET /api/threads/[threadId]/actions
 * List available actions for this thread's agent (builtin + declared).
 */
export async function GET(
  req: NextRequest,
  props: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await props.params;

  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServerClient();
  const { data: thread } = await db
    .from("threads")
    .select("agent_api_key_id")
    .eq("id", threadId)
    .eq("company_id", userCompany.companyId)
    .single();

  if (!thread) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  const builtinActions = [...BUILTIN_ACTIONS].map((name) => ({
    name,
    description: name === "generate_summary" ? "Generate a thread summary" : "Auto-generate tags",
    parameter_schema: {},
    builtin: true,
  }));

  if (!thread.agent_api_key_id) {
    return Response.json({ actions: builtinActions });
  }

  const { data: declared } = await db
    .from("agent_actions")
    .select("id, name, description, parameter_schema, created_at")
    .eq("api_key_id", thread.agent_api_key_id)
    .order("created_at", { ascending: true });

  const agentActions = (declared ?? []).map(
    (a: { id: string; name: string; description: string; parameter_schema: unknown; created_at: string }) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      parameter_schema: a.parameter_schema,
      builtin: false,
    }),
  );

  return Response.json({ actions: [...builtinActions, ...agentActions] });
}
