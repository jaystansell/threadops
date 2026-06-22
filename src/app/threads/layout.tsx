import { redirect } from "next/navigation";
import { createServerClient } from "@/adapters/supabase/client";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { ThreadSidebar } from "@/app/_components/thread-sidebar";
import { MobileMainWrapper } from "@/app/_components/mobile-main-wrapper";
import type { Thread } from "@/core/types";

export const dynamic = "force-dynamic";

const INITIAL_LOAD = 100;

type LastMessageRow = {
  thread_id: string;
  author_kind: "user" | "agent";
  author_name: string | null;
  created_at: string;
};

export type ThreadWithLastMessage = Thread & {
  last_author_kind?: "user" | "agent";
  last_author_name?: string | null;
  last_message_at?: string;
  agent_name?: string | null;
  tags?: string[];
};

export default async function ThreadsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userCompany = await getUserCompany();
  if (!userCompany) redirect("/onboarding");

  const db = createServerClient();

  // Fetch initial threads (most recent first, open by default)
  const { data, error } = await db
    .from("threads")
    .select("*")
    .eq("company_id", userCompany.companyId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .range(0, INITIAL_LOAD - 1);

  if (error) throw error;
  const threads = (data ?? []) as Thread[];

  // Fetch last message for each thread
  const threadIds = threads.map((t) => t.id);
  const lastMessageMap = new Map<string, LastMessageRow>();

  const agentMap = new Map<string, string>();

  if (threadIds.length > 0) {
    const [lastMsgResults, agentMsgResults] = await Promise.all([
      Promise.all(
        threadIds.map((tid) =>
          db
            .from("messages")
            .select("thread_id, author_kind, author_name, created_at")
            .eq("thread_id", tid)
            .order("created_at", { ascending: false })
            .limit(1),
        ),
      ),
      Promise.all(
        threadIds.map((tid) =>
          db
            .from("messages")
            .select("thread_id, author_name")
            .eq("thread_id", tid)
            .eq("author_kind", "agent")
            .order("created_at", { ascending: true })
            .limit(1),
        ),
      ),
    ]);
    for (const { data: msgs } of lastMsgResults) {
      if (msgs && msgs.length > 0) {
        const row = msgs[0] as LastMessageRow;
        lastMessageMap.set(row.thread_id, row);
      }
    }
    for (const { data: msgs } of agentMsgResults) {
      if (msgs && msgs.length > 0) {
        const row = msgs[0] as { thread_id: string; author_name: string | null };
        if (row.author_name) {
          agentMap.set(row.thread_id, row.author_name);
        }
      }
    }
  }

  // Fetch tags for all threads
  const tagMap = new Map<string, string[]>();
  if (threadIds.length > 0) {
    const { data: allTags } = await db
      .from("thread_tags")
      .select("thread_id, tag")
      .in("thread_id", threadIds);
    for (const row of allTags ?? []) {
      const existing = tagMap.get(row.thread_id) ?? [];
      existing.push(row.tag);
      tagMap.set(row.thread_id, existing);
    }
  }

  const threadsWithLastMsg: ThreadWithLastMessage[] = threads.map((t) => {
    const lm = lastMessageMap.get(t.id);
    return {
      ...t,
      tags: tagMap.get(t.id) ?? [],
      last_author_kind: lm?.author_kind,
      last_author_name: lm?.author_name,
      last_message_at: lm?.created_at,
      agent_name: agentMap.get(t.id) ?? null,
    };
  });

  // Detect agents without webhook endpoints (per-agent check)
  const [apiKeysResult, webhookEndpointsResult] = await Promise.all([
    db
      .from("api_keys")
      .select("id, label")
      .eq("company_id", userCompany.companyId)
      .or(`created_by.eq.${userCompany.userId},created_by.is.null`)
      .is("revoked_at", null),
    db
      .from("webhook_endpoints")
      .select("api_key_id")
      .eq("company_id", userCompany.companyId)
      .eq("active", true),
  ]);

  const agentKeys = (apiKeysResult.data ?? []) as Array<{ id: string; label: string }>;
  const webhookKeyIds = new Set(
    (webhookEndpointsResult.data ?? [])
      .map((w: { api_key_id: string | null }) => w.api_key_id)
      .filter(Boolean),
  );
  const agentsWithoutWebhooks = agentKeys
    .filter((k) => !webhookKeyIds.has(k.id))
    .map((k) => k.label);

  return (
    <div className="flex flex-1 overflow-hidden">
      <ThreadSidebar
        initialThreads={threadsWithLastMsg}
        companyId={userCompany.companyId}
        agentsWithoutWebhooks={agentsWithoutWebhooks}
      />
      <main className="flex-1 overflow-y-auto">
        <MobileMainWrapper>
          {children}
        </MobileMainWrapper>
      </main>
    </div>
  );
}
