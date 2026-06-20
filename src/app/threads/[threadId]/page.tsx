import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/adapters/supabase/client";
import { createThreadRepo } from "@/adapters/supabase/thread-repo";
import { createMessageRepo } from "@/adapters/supabase/message-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import type { ThreadId, Theme } from "@/core/types";
import { ThreadTimeline } from "@/app/_components/thread-timeline";
import { MessageComposer } from "@/app/_components/message-composer";
import { ThreadStatusActions } from "@/app/_components/thread-status-actions";

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

  let themeName: string | null = null;
  if (thread.theme_id) {
    const { data: theme } = await db
      .from("themes")
      .select("name")
      .eq("id", thread.theme_id)
      .single();
    themeName = (theme as Theme | null)?.name ?? null;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/threads"
          className="text-sm text-[var(--primary)] hover:underline"
        >
          &larr; All Threads
        </Link>
        <h2 className="text-xl font-bold mt-2">{thread.title}</h2>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
            {thread.status}
          </span>
          {themeName && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
              {themeName}
            </span>
          )}
          <span className="text-xs text-[var(--muted-foreground)]">
            {new Date(thread.created_at).toLocaleDateString()}
          </span>
        </div>
        <div className="mt-3">
          <ThreadStatusActions
            threadId={threadId}
            companyId={userCompany.companyId}
            currentStatus={thread.status}
          />
        </div>
      </div>

      <ThreadTimeline initialMessages={messages} threadId={threadId} />

      {thread.status === "open" && (
        <MessageComposer threadId={threadId} userId={userCompany.userId} />
      )}
    </div>
  );
}
