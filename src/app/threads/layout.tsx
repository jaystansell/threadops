import { redirect } from "next/navigation";
import { createServerClient } from "@/adapters/supabase/client";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { ThreadSidebar } from "@/app/_components/thread-sidebar";
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

  if (threadIds.length > 0) {
    const results = await Promise.all(
      threadIds.map((tid) =>
        db
          .from("messages")
          .select("thread_id, author_kind, author_name, created_at")
          .eq("thread_id", tid)
          .order("created_at", { ascending: false })
          .limit(1),
      ),
    );
    for (const { data: msgs } of results) {
      if (msgs && msgs.length > 0) {
        const row = msgs[0] as LastMessageRow;
        lastMessageMap.set(row.thread_id, row);
      }
    }
  }

  const threadsWithLastMsg: ThreadWithLastMessage[] = threads.map((t) => {
    const lm = lastMessageMap.get(t.id);
    return {
      ...t,
      last_author_kind: lm?.author_kind,
      last_author_name: lm?.author_name,
      last_message_at: lm?.created_at,
    };
  });

  return (
    <div className="flex flex-1 overflow-hidden">
      <ThreadSidebar
        initialThreads={threadsWithLastMsg}
        companyId={userCompany.companyId}
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}
