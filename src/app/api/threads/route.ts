import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createThreadRepo } from "@/adapters/supabase/thread-repo";
import { createMessageRepo } from "@/adapters/supabase/message-repo";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";
import type { CompanyId, ThemeId, ThreadId } from "@/core/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return Response.json(
      { error: "title is required and must be a non-empty string" },
      { status: 400 },
    );
  }

  if (!body.company_id || typeof body.company_id !== "string") {
    return Response.json(
      { error: "company_id is required" },
      { status: 400 },
    );
  }

  if (
    !body.message_body ||
    typeof body.message_body !== "string" ||
    !body.message_body.trim()
  ) {
    return Response.json(
      { error: "message_body is required and must be a non-empty string" },
      { status: 400 },
    );
  }

  const db = createServerClient();
  const threadRepo = createThreadRepo(db);
  const messageRepo = createMessageRepo(db);

  try {
    const thread = await threadRepo.create({
      company_id: body.company_id as CompanyId,
      theme_id: body.theme_id ? (body.theme_id as ThemeId) : undefined,
      title: body.title.trim(),
      created_by: user.id,
    });

    await messageRepo.create({
      thread_id: thread.id as ThreadId,
      author_id: user.id,
      author_kind: "user",
      body: body.message_body.trim(),
    });

    return Response.json(thread, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
