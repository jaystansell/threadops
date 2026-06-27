import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { getAdminUser } from "@/adapters/supabase/auth/require-admin";
import type { AgentFeedbackStatus } from "@/core/types";

export const dynamic = "force-dynamic";

const VALID_STATUSES: AgentFeedbackStatus[] = [
  "pending",
  "approved",
  "rejected",
  "shipped",
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const status = body.status as string | undefined;
  if (!status || !VALID_STATUSES.includes(status as AgentFeedbackStatus)) {
    return Response.json(
      { error: `status is required and must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  const db = createServerClient();

  try {
    const updatePayload: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (body.admin_notes !== undefined) {
      updatePayload.admin_notes = body.admin_notes;
    }

    const { data, error } = await db
      .from("agent_feedback")
      .update(updatePayload)
      .eq("id", id)
      .eq("company_id", adminUser.companyId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return Response.json({ error: "Feedback not found" }, { status: 404 });
    }

    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
