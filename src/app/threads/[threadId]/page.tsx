import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/adapters/supabase/client";
import { createThreadRepo } from "@/adapters/supabase/thread-repo";
import { createMessageRepo } from "@/adapters/supabase/message-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import type { ThreadId } from "@/core/types";
import { ThreadDetailClient } from "@/app/_components/thread-detail-client";
import { FormattedDate } from "@/app/_components/formatted-date";
import { ThreadActionsPanel } from "@/app/_components/thread-actions-panel";

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

  // Fetch tags
  const { data: tagRows } = await db
    .from("thread_tags")
    .select("tag")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  const tags = (tagRows ?? []).map((r: { tag: string }) => r.tag);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold">{thread.title}</h2>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
            {thread.status}
          </span>
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
      </div>

      <ThreadDetailClient
        messages={messages}
        threadId={threadId}
        userId={userCompany.userId}
        isOpen={thread.status === "open"}
        threadEvents={threadEvents}
      />
    </div>
  );
}
