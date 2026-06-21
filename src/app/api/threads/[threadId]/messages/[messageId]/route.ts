import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { hashKey } from "@/core/rules/api-key";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ threadId: string; messageId: string }> },
) {
  const { threadId, messageId } = await props.params;
  const db = createServerClient();

  const apiKey = req.headers.get("x-api-key");
  let companyId: string;

  if (apiKey) {
    const apiKeyRepo = createApiKeyRepo(db);
    const keyHash = await hashKey(apiKey);
    const keyRecord = await apiKeyRepo.lookupByHash(keyHash);
    if (!keyRecord) {
      return Response.json({ error: "Invalid API key" }, { status: 401 });
    }
    await apiKeyRepo.touchLastUsed(keyRecord.id);

    const { data: thread } = await db
      .from("threads")
      .select("company_id, agent_api_key_id")
      .eq("id", threadId)
      .single();
    if (!thread) {
      return Response.json({ error: "Thread not found" }, { status: 404 });
    }
    if (thread.company_id !== keyRecord.company_id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (thread.agent_api_key_id && thread.agent_api_key_id !== keyRecord.id) {
      return Response.json(
        { error: "This thread belongs to another agent" },
        { status: 403 },
      );
    }

    companyId = keyRecord.company_id;
  } else {
    const userCompany = await getUserCompany();
    if (!userCompany) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    companyId = userCompany.companyId;

    const { data: thread } = await db
      .from("threads")
      .select("company_id")
      .eq("id", threadId)
      .eq("company_id", companyId)
      .single();
    if (!thread) {
      return Response.json({ error: "Thread not found" }, { status: 404 });
    }
  }

  // Verify message belongs to the thread
  const { data: message } = await db
    .from("messages")
    .select("id")
    .eq("id", messageId)
    .eq("thread_id", threadId)
    .single();

  if (!message) {
    return Response.json({ error: "Message not found" }, { status: 404 });
  }

  // Hard delete the message
  const { error: deleteError } = await db
    .from("messages")
    .delete()
    .eq("id", messageId)
    .eq("thread_id", threadId);

  if (deleteError) {
    return Response.json({ error: deleteError.message }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
