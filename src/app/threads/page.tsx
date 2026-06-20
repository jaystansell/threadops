import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/adapters/supabase/client";
import { createThreadRepo } from "@/adapters/supabase/thread-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import type { Thread } from "@/core/types";

export const dynamic = "force-dynamic";

export default async function ThreadsPage() {
  const userCompany = await getUserCompany();
  if (!userCompany) redirect("/onboarding");

  const db = createServerClient();
  const threadRepo = createThreadRepo(db);

  let threads: Thread[];
  try {
    threads = await threadRepo.list(userCompany.companyId);
  } catch {
    threads = [];
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Threads</h2>
        <span className="text-xs text-[var(--muted-foreground)]">
          {threads.length} thread{threads.length !== 1 ? "s" : ""}
        </span>
      </div>

      {threads.length === 0 ? (
        <p className="text-[var(--muted-foreground)] text-sm">
          No threads yet. Create one to get started, or apply the seed data.
        </p>
      ) : (
        <ul className="space-y-2">
          {threads.map((thread) => (
            <li key={thread.id}>
              <Link
                href={`/threads/${thread.id}`}
                className="block rounded-lg border border-[var(--border)] p-4 hover:border-[var(--primary)] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{thread.title}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
                    {thread.status}
                  </span>
                </div>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  {new Date(thread.created_at).toLocaleDateString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
