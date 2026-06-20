import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createThreadRepo } from "@/adapters/supabase/thread-repo";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";
import { canTransition, InvalidStatusTransitionError } from "@/core/rules";
import type { CompanyId, ThreadId, ThreadStatus } from "@/core/types";

export const dynamic = "force-dynamic";

const VALID_STATUSES: ThreadStatus[] = ["open", "closed", "archived"];

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/threads/[threadId]/status">,
) {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await ctx.params;
  const body = await req.json();

  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return Response.json(
      { error: "status must be one of: open, closed, archived" },
      { status: 400 },
    );
  }

  if (!body.company_id || typeof body.company_id !== "string") {
    return Response.json(
      { error: "company_id is required" },
      { status: 400 },
    );
  }

  const db = createServerClient();
  const threadRepo = createThreadRepo(db);

  try {
    const thread = await threadRepo.getById(
      body.company_id as CompanyId,
      threadId as ThreadId,
    );

    if (!thread) {
      return Response.json({ error: "Thread not found" }, { status: 404 });
    }

    const newStatus = body.status as ThreadStatus;

    if (!canTransition(thread.status, newStatus)) {
      throw new InvalidStatusTransitionError(thread.status, newStatus);
    }

    const updated = await threadRepo.updateStatus(
      body.company_id as CompanyId,
      threadId as ThreadId,
      newStatus,
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
