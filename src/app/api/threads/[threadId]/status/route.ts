import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createThreadRepo } from "@/adapters/supabase/thread-repo";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";
import { canTransition, InvalidStatusTransitionError } from "@/core/rules";
import { dispatchOutboundWebhooks } from "@/adapters/supabase/outbound-webhook";
import { hashKey } from "@/core/rules/api-key";
import type { CompanyId, ThreadId, ThreadStatus } from "@/core/types";

export const dynamic = "force-dynamic";

const VALID_STATUSES: ThreadStatus[] = ["open", "archived"];

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/threads/[threadId]/status">,
) {
  const apiKey = req.headers.get("x-api-key");
  let apiKeyCompanyId: string | null = null;
  let apiKeyId: string | null = null;

  if (apiKey) {
    const db = createServerClient();
    const apiKeyRepo = createApiKeyRepo(db);
    const keyHash = await hashKey(apiKey);
    const keyRecord = await apiKeyRepo.lookupByHash(keyHash);
    if (!keyRecord) {
      return Response.json({ error: "Invalid API key" }, { status: 401 });
    }
    await apiKeyRepo.touchLastUsed(keyRecord.id);
    apiKeyCompanyId = keyRecord.company_id;
    apiKeyId = keyRecord.id;
  } else {
    const supabase = await createAuthServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { threadId } = await ctx.params;
  const body = await req.json();

  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return Response.json(
      { error: "status must be one of: open, archived" },
      { status: 400 },
    );
  }

  const companyId = apiKeyCompanyId ?? body.company_id;

  if (!companyId || typeof companyId !== "string") {
    return Response.json(
      { error: "company_id is required" },
      { status: 400 },
    );
  }

  const db = createServerClient();
  const threadRepo = createThreadRepo(db);

  try {
    const thread = await threadRepo.getById(
      companyId as CompanyId,
      threadId as ThreadId,
    );

    if (!thread) {
      return Response.json({ error: "Thread not found" }, { status: 404 });
    }

    if (apiKeyId && thread.agent_api_key_id && thread.agent_api_key_id !== apiKeyId) {
      return Response.json(
        { error: "This thread belongs to another agent" },
        { status: 403 },
      );
    }

    const newStatus = body.status as ThreadStatus;

    if (!canTransition(thread.status, newStatus)) {
      throw new InvalidStatusTransitionError(thread.status, newStatus);
    }

    const updated = await threadRepo.updateStatus(
      companyId as CompanyId,
      threadId as ThreadId,
      newStatus,
    );

    dispatchOutboundWebhooks(
      companyId as CompanyId,
      "thread.status_changed",
      {
        thread_id: threadId,
        previous_status: thread.status,
        new_status: updated.status,
        company_id: updated.company_id,
        updated_at: updated.updated_at,
      },
    );

    return Response.json(updated);
  } catch (err) {
    if (err instanceof InvalidStatusTransitionError) {
      return Response.json({ error: err.message }, { status: 422 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
