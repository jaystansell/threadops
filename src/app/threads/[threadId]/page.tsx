import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/adapters/supabase/client";
import { createThreadRepo } from "@/adapters/supabase/thread-repo";
import { createMessageRepo } from "@/adapters/supabase/message-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import type { ThreadId } from "@/core/types";
import { ThreadDetailClient } from "@/app/_components/thread-detail-client";
import { FormattedDate } from "@/app/_components/formatted-date";
import { ThreadActionsPanel } from "@/app/_components/thread-actions-panel";
import { ThreadSavingsBanner } from "@/app/_components/thread-savings-banner";
import { CopyableId } from "@/app/_components/copyable-id";
import { ThreadDebugPanel } from "@/app/_components/thread-debug-panel";

export const dynamic = "force-dynamic";

export default async function ThreadDetailPage(
  props: PageProps<"/threads/[threadId]">
) {
  const userCompany = await getUserCompany();
  if (!userCompany) redirect("/onboarding");

  const { threadId } = await props.params;
  const db = createServerClient();
  const threadRepo = createThreadRepo(db);
  const messageRepo = createMessageRepo(db);

  const thread = await threadRepo.getById(
    userCompany.companyId,
    threadId as ThreadId,
  );
  if (!thread) notFound();

  const messages = await messageRepo.listByThread(threadId as ThreadId);

  // Fetch attachment counts per message
  const messageIds = messages.map((m) => m.id);
  const attachmentCounts: Record<string, number> = {};
  if (messageIds.length > 0) {
    const { data: attRows } = await db
      .from("message_attachments")
      .select("message_id")
      .in("message_id", messageIds);
    if (attRows) {
      for (const row of attRows) {
        const mid = (row as { message_id: string }).message_id;
        attachmentCounts[mid] = (attachmentCounts[mid] ?? 0) + 1;
      }
    }
  }

  // Fetch thread events (status changes, auto-reopens)
  const { data: eventRows } = await db
    .from("thread_events")
    .select("id, event_type, actor_kind, actor_label, old_value, new_value, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  const threadEvents = (eventRows ?? []) as Array<{
    id: string;
    event_type: string;
    actor_kind: string;
    actor_label: string | null;
    old_value: string | null;
    new_value: string | null;
    created_at: string;
  }>;

  // Fetch usage read count and model tier for savings banner
  const { data: usageRows } = await db
    .from("usage_logs")
    .select("model_tier")
    .eq("thread_id", threadId);
  const readCount = usageRows?.length ?? 0;
  const modelTier = (usageRows?.[0]?.model_tier as string) ?? "standard";

  // Fetch model pricing from DB for accurate cost display
  const { data: pricingRows } = await db
    .from("model_pricing")
    .select("cost_per_mtok")
    .eq("model_tier", modelTier)
    .limit(1);
  const costPerMTok = pricingRows?.[0]
    ? Number(pricingRows[0].cost_per_mtok)
    : null;

  // Fetch tags
  const { data: tagRows } = await db
    .from("thread_tags")
    .select("tag")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  const tags = (tagRows ?? []).map((r: { tag: string }) => r.tag);

  // Fetch latest agent processing status for this thread
  let agentProcessingStatus: string | null = null;
  {
    const { data: statusRows } = await db
      .from("agent_processing_status")
      .select("status")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (statusRows && statusRows.length > 0) {
      agentProcessingStatus = (statusRows[0] as { status: string }).status;
    }
  }

  // Fetch agent name and revocation status for this thread
  let agentName: string | null = null;
  let isAgentRevoked = false;
  if (thread.agent_api_key_id) {
    const { data: keyRow } = await db
      .from("api_keys")
      .select("label, revoked_at")
      .eq("id", thread.agent_api_key_id)
      .limit(1)
      .single();
    agentName = (keyRow as { label: string; revoked_at: string | null } | null)?.label ?? null;
    isAgentRevoked = !!(keyRow as { revoked_at: string | null } | null)?.revoked_at;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <CopyableId label="Thread ID" value={threadId} />
        <h2 className="text-xl font-bold">{thread.title}</h2>
        {isAgentRevoked && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2">
            <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <p className="text-xs text-red-300">
              This agent has been disconnected. No new messages will be delivered to it.
            </p>
          </div>
        )}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {agentName && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              isAgentRevoked
                ? "bg-red-900/30 text-red-400 line-through"
                : "bg-[var(--accent)]/15 text-[var(--accent)]"
            }`}>
              {agentName}
            </span>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
            {thread.status}
          </span>
          {(agentProcessingStatus === "acknowledged" || agentProcessingStatus === "processing") && (
            <span className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_6px_rgba(59,130,246,0.7)]" />
              {agentProcessingStatus === "acknowledged" ? "Agent acknowledged" : "Agent processing"}
            </span>
          )}
          <span className="text-xs text-[var(--muted-foreground)]">
            <FormattedDate date={thread.created_at} />
          </span>
        </div>
        <ThreadActionsPanel
          threadId={threadId}
          companyId={userCompany.companyId}
          currentStatus={thread.status}
          initialTags={tags}
          initialSummary={thread.summary ?? ""}
        />
        <ThreadDebugPanel
          threadId={threadId}
          agentName={agentName}
          threadTitle={thread.title}
          messageCount={messages.length}
          lastMessageAt={messages.length > 0 ? messages[messages.length - 1].created_at : null}
          lastUserMessageAt={
            [...messages].reverse().find((m) => m.author_kind === "user")?.created_at ?? null
          }
          lastAgentMessageAt={
            [...messages].reverse().find((m) => m.author_kind === "agent")?.created_at ?? null
          }
          isAgentRevoked={isAgentRevoked}
        />
        <ThreadSavingsBanner
          messageCount={messages.length}
          readCount={readCount}
          modelTier={modelTier}
          costPerMTok={costPerMTok}
        />
      </div>

      <ThreadDetailClient
        messages={messages}
        threadId={threadId}
        userId={userCompany.userId}
        isOpen={thread.status === "open"}
        isAgentRevoked={isAgentRevoked}
        agentName={agentName}
        agentApiKeyId={thread.agent_api_key_id}
        threadEvents={threadEvents}
        attachmentCounts={attachmentCounts}
      />
    </div>
  );
}
