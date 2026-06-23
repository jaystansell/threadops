import { createServerClient } from "@/adapters/supabase/client";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";

export const dynamic = "force-dynamic";

/**
 * GET /api/threads/[threadId]/messages/[messageId]/deliveries
 *
 * Returns webhook deliveries triggered by this message.
 * Looks up deliveries where payload->>'message_id' matches.
 */
export async function GET(
  _req: Request,
  props: { params: Promise<{ threadId: string; messageId: string }> },
) {
  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId, messageId } = await props.params;

  const db = createServerClient();

  // Verify thread belongs to this company
  const { data: thread } = await db
    .from("threads")
    .select("id")
    .eq("id", threadId)
    .eq("company_id", userCompany.companyId)
    .single();

  if (!thread) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  // Find webhook deliveries where this message_id is in the payload
  const { data: deliveries, error } = await db
    .from("webhook_deliveries")
    .select("id, status, event_type, attempts, last_error, created_at, processed_at")
    .eq("company_id", userCompany.companyId)
    .eq("source", "outbound")
    .filter("payload->>message_id", "eq", messageId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    return Response.json(
      { error: error.message },
      { status: 500 },
    );
  }

  return Response.json({ deliveries: deliveries ?? [] });
}
