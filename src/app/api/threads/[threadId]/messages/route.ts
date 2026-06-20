import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createMessageRepo } from "@/adapters/supabase/message-repo";
import type { ThreadId } from "@/core/types";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/threads/[threadId]/messages">,
) {
  const { threadId } = await ctx.params;
  const db = createServerClient();
  const messageRepo = createMessageRepo(db);

  try {
    const messages = await messageRepo.listByThread(threadId as ThreadId);
    return Response.json(messages);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/threads/[threadId]/messages">,
) {
  const { threadId } = await ctx.params;
  const body = await req.json();

  if (!body.body || typeof body.body !== "string") {
    return Response.json(
      { error: "body is required and must be a string" },
      { status: 400 },
    );
  }

  const db = createServerClient();
  const messageRepo = createMessageRepo(db);

  try {
    const message = await messageRepo.create({
      thread_id: threadId as ThreadId,
      author_id: body.author_id ?? crypto.randomUUID(),
      author_kind: body.author_kind ?? "user",
      body: body.body,
    });
    return Response.json(message, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
