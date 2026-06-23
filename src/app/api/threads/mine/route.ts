import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { resolveApiKey } from "@/adapters/supabase/api-key-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/threads/mine
 *
 * Returns a compact list of threads owned by the calling agent.
 * Agents can use this to verify thread IDs before posting, avoiding
 * hallucinated or stale thread ID errors.
 */
export async function GET(req: NextRequest) {
  const apiKeyResult = await resolveApiKey(req);
  if (apiKeyResult.kind === "invalid" || apiKeyResult.kind === "rate_limited") {
    return apiKeyResult.response;
  }
  if (apiKeyResult.kind === "none") {
    return Response.json(
      { error: "API key required. Pass your key in the X-API-Key header." },
      { status: 401 },
    );
  }

  const { companyId, keyId, keyLabel } = apiKeyResult;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "open";
  const limit = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50),
  );

  const db = createServerClient();

  const query = db
    .from("threads")
    .select("id, title, status, created_at, updated_at")
    .eq("company_id", companyId)
    .eq("agent_api_key_id", keyId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (status === "open" || status === "archived") {
    query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://threadops-jade.vercel.app";

  return Response.json({
    agent: keyLabel,
    thread_count: data?.length ?? 0,
    threads: (data ?? []).map((t) => ({
      ...t,
      thread_url: `${appUrl}/threads/${t.id}`,
      reply_endpoint: `POST /api/threads/${t.id}/messages`,
    })),
  });
}
