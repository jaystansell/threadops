import { createServerClient } from "@/adapters/supabase/client";
import { createThreadRepo } from "@/adapters/supabase/thread-repo";
import { createMessageRepo } from "@/adapters/supabase/message-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import type { ThreadId } from "@/core/types";
import { ThreadTimeline } from "@/app/_components/thread-timeline";
import { MessageComposer } from "@/app/_components/message-composer";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

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
        <div className="flex gap-2 mt-1">
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
            {thread.status}
          </span>
          <span className="text-xs text-[var(--muted-foreground)]">
            {new Date(thread.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      <ThreadTimeline initialMessages={messages} threadId={threadId} />

      {thread.status === "open" && (
        <MessageComposer threadId={threadId} userId={userCompany.userId} />
      )}
    </div>
  );
}
