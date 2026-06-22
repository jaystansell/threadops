import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { resolveApiKey } from "@/adapters/supabase/api-key-auth";
import type {
  AgentFeedbackCategory,
  AgentFeedbackPriority,
} from "@/core/types";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES: AgentFeedbackCategory[] = [
  "webhook_filter",
  "api_feature",
  "payload_field",
  "bug_report",
  "general",
];

const VALID_PRIORITIES: AgentFeedbackPriority[] = ["high", "medium", "low"];

export async function POST(req: NextRequest) {
  const apiKeyResult = await resolveApiKey(req);
  if (apiKeyResult.kind === "invalid" || apiKeyResult.kind === "rate_limited") {
    return apiKeyResult.response;
  }
  if (apiKeyResult.kind === "none") {
    return Response.json({ error: "API key required" }, { status: 401 });
  }

  const body = await req.json();

  const category = body.category as string | undefined;
  if (!category || !VALID_CATEGORIES.includes(category as AgentFeedbackCategory)) {
    return Response.json(
      { error: `category is required and must be one of: ${VALID_CATEGORIES.join(", ")}` },
      { status: 400 },
    );
  }

  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return Response.json(
      { error: "title is required and must be a non-empty string" },
      { status: 400 },
    );
  }

  if (!body.description || typeof body.description !== "string" || !body.description.trim()) {
    return Response.json(
      { error: "description is required and must be a non-empty string" },
      { status: 400 },
    );
  }

  const priority = body.priority ?? "medium";
  if (!VALID_PRIORITIES.includes(priority as AgentFeedbackPriority)) {
    return Response.json(
      { error: `priority must be one of: ${VALID_PRIORITIES.join(", ")}` },
      { status: 400 },
    );
  }

  const db = createServerClient();

  try {
    const { data, error } = await db
      .from("agent_feedback")
      .insert({
        company_id: apiKeyResult.companyId,
        api_key_id: apiKeyResult.keyId,
        category,
        title: body.title.trim(),
        description: body.description.trim(),
        priority,
      })
      .select()
      .single();

    if (error) throw error;
    return Response.json(data, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const apiKeyResult = await resolveApiKey(req);
  if (apiKeyResult.kind === "invalid" || apiKeyResult.kind === "rate_limited") {
    return apiKeyResult.response;
  }
  if (apiKeyResult.kind === "none") {
    return Response.json({ error: "API key required" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");

  const db = createServerClient();

  try {
    let query = db
      .from("agent_feedback")
      .select("*")
      .eq("company_id", apiKeyResult.companyId)
      .eq("api_key_id", apiKeyResult.keyId)
      .order("created_at", { ascending: false });

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
