import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";
import type { AgentFeedbackStatus } from "@/core/types";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "jay+direct@productcoalition.com";

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
  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
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
      .eq("company_id", userCompany.companyId)
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
