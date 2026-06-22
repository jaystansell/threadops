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

export type AgentGroup = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  agent_key_ids: string[];
};

export type AgentKeyInfo = {
  id: string;
  label: string;
  revoked: boolean;
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

  // Detect agents without webhook endpoints + fetch agent groups
  const [apiKeysResult, webhookEndpointsResult, agentGroupsResult] = await Promise.all([
    db
      .from("api_keys")
      .select("id, label, revoked_at")
      .eq("company_id", userCompany.companyId)
      .or(`created_by.eq.${userCompany.userId},created_by.is.null`),
    db
      .from("webhook_endpoints")
      .select("api_key_id")
      .eq("company_id", userCompany.companyId)
      .eq("active", true),
    db
      .from("agent_groups")
      .select("id, name, color, sort_order")
      .eq("company_id", userCompany.companyId)
      .eq("user_id", userCompany.userId)
      .order("sort_order", { ascending: true }),
  ]);

  const rawAgentKeys = (apiKeysResult.data ?? []) as Array<{ id: string; label: string; revoked_at: string | null }>;
  const agentKeys: AgentKeyInfo[] = rawAgentKeys.map((k) => ({ id: k.id, label: k.label, revoked: !!k.revoked_at }));
  const keyLabelMap = new Map(agentKeys.map((k) => [k.id, k.label]));
  const revokedKeyIds = new Set(rawAgentKeys.filter((k) => k.revoked_at).map((k) => k.id));
  const webhookKeyIds = new Set(
    (webhookEndpointsResult.data ?? [])
      .map((w: { api_key_id: string | null }) => w.api_key_id)
      .filter(Boolean),
  );
  const agentsWithoutWebhooks = agentKeys
    .filter((k) => !k.revoked && !webhookKeyIds.has(k.id))
    .map((k) => k.label);

  // Build agent groups with members (filtered by user's group IDs only)
  const groupIds = (agentGroupsResult.data ?? []).map((g: { id: string }) => g.id);
  const groupMembersMap: Record<string, string[]> = {};
  if (groupIds.length > 0) {
    const { data: members } = await db
      .from("agent_group_members")
      .select("group_id, api_key_id")
      .in("group_id", groupIds);
    for (const m of members ?? []) {
      const gid = m.group_id as string;
      if (!groupMembersMap[gid]) groupMembersMap[gid] = [];
      groupMembersMap[gid].push(m.api_key_id as string);
    }
  }
  const agentGroups: AgentGroup[] = (agentGroupsResult.data ?? []).map(
    (g: { id: string; name: string; color: string; sort_order: number }) => ({
      ...g,
      agent_key_ids: groupMembersMap[g.id] ?? [],
    }),
  );

  // Back-fill agent_name from api_keys for threads that have agent_api_key_id
  // but no agent message yet (e.g. agent has no webhook and never posted)
  for (const t of threadsWithLastMsg) {
    if (!t.agent_name && t.agent_api_key_id) {
      const label = keyLabelMap.get(t.agent_api_key_id);
      if (label) t.agent_name = label;
    }
  }

  return (
    <div className="flex flex-1 min-h-0 max-h-[calc(100dvh-3.25rem)] overflow-hidden">
      <ThreadSidebar
        initialThreads={threadsWithLastMsg}
        companyId={userCompany.companyId}
        agentsWithoutWebhooks={agentsWithoutWebhooks}
        agentGroups={agentGroups}
        agentKeys={agentKeys}
        revokedKeyIds={[...revokedKeyIds]}
      />
      <main className="flex-1 overflow-y-auto">
        <MobileMainWrapper>
          {children}
        </MobileMainWrapper>
      </main>
    </div>
  );
}
