import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createThreadRepo } from "@/adapters/supabase/thread-repo";
import { createMessageRepo } from "@/adapters/supabase/message-repo";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { dispatchOutboundWebhooks } from "@/adapters/supabase/outbound-webhook";
import { hashKey } from "@/core/rules/api-key";
import type { CompanyId, ThreadId, ThreadStatus } from "@/core/types";

export const dynamic = "force-dynamic";

const VALID_STATUSES: ThreadStatus[] = ["open", "closed", "archived"];

type ApiKeyResult =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "ok"; companyId: string; keyLabel: string; keyId: string };

async function resolveApiKeyCompany(req: NextRequest): Promise<ApiKeyResult> {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return { kind: "none" };
  const db = createServerClient();
  const apiKeyRepo = createApiKeyRepo(db);
  const keyHash = await hashKey(apiKey);
  const keyRecord = await apiKeyRepo.lookupByHash(keyHash);
  if (!keyRecord) return { kind: "invalid" };
  await apiKeyRepo.touchLastUsed(keyRecord.id);
  return {
    kind: "ok",
    companyId: keyRecord.company_id,
    keyLabel: keyRecord.label,
    keyId: keyRecord.id,
  };
}

export async function GET(req: NextRequest) {
  let companyId: string;

  const apiKeyResult = await resolveApiKeyCompany(req);
  if (apiKeyResult.kind === "invalid") {
    return Response.json({ error: "Invalid API key" }, { status: 401 });
  } else if (apiKeyResult.kind === "ok") {
    companyId = apiKeyResult.companyId;
  } else {
    const userCompany = await getUserCompany();
    if (!userCompany) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    companyId = userCompany.companyId;
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10) || 100),
  );
  const offset = Math.max(
    0,
    parseInt(searchParams.get("offset") ?? "0", 10) || 0,
  );
  const searchQuery = searchParams.get("q")?.trim() ?? "";
  const statusParam = searchParams.get("status") ?? "";

  const db = createServerClient();

  let query = db
    .from("threads")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (VALID_STATUSES.includes(statusParam as ThreadStatus)) {
    query = query.eq("status", statusParam);
  }
  if (searchQuery) {
    const escaped = searchQuery.replace(/[%_\\]/g, "\\$&");
    query = query.ilike("title", `%${escaped}%`);
  }

  query = query.range(offset, offset + limit - 1);

  try {
    const { data, error } = await query;
    if (error) throw error;

    const threads = data ?? [];

    // Fetch last message for each thread
    const enriched = await Promise.all(
      threads.map(async (thread) => {
        const { data: msgs } = await db
          .from("messages")
          .select("author_kind, author_name, created_at")
          .eq("thread_id", thread.id)
          .order("created_at", { ascending: false })
          .limit(1);

        const lm = msgs?.[0];
        return {
          ...thread,
          last_author_kind: lm?.author_kind ?? null,
          last_author_name: lm?.author_name ?? null,
          last_message_at: lm?.created_at ?? null,
        };
      }),
    );

    return Response.json(enriched);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  let authorId: string;
  let authorKind: "user" | "agent" = "user";
  let authorName: string | null = null;
  let apiKeyCompanyId: string | null = null;

  const apiKeyResult = await resolveApiKeyCompany(req);
  if (apiKeyResult.kind === "invalid") {
    return Response.json({ error: "Invalid API key" }, { status: 401 });
  } else if (apiKeyResult.kind === "ok") {
    authorId = apiKeyResult.keyId;
    authorKind = "agent";
    authorName = apiKeyResult.keyLabel;
    apiKeyCompanyId = apiKeyResult.companyId;
  } else {
    const supabase = await createAuthServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    authorId = user.id;
  }

  const body = await req.json();

  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return Response.json(
      { error: "title is required and must be a non-empty string" },
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
      company_id: companyId as CompanyId,
      title: body.title.trim(),
      created_by: authorId,
    });

    await messageRepo.create({
      thread_id: thread.id as ThreadId,
      author_id: authorId,
      author_kind: authorKind,
      author_name: authorName,
      body: body.message_body.trim(),
    });

    dispatchOutboundWebhooks(companyId as CompanyId, "thread.created", {
      thread_id: thread.id,
      title: thread.title,
      status: thread.status,
      company_id: thread.company_id,
      created_by: thread.created_by,
      created_at: thread.created_at,
    });

    return Response.json(thread, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
