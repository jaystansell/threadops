import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/adapters/supabase/client";
import { createThreadRepo } from "@/adapters/supabase/thread-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { ThemeFilter } from "@/app/_components/theme-filter";
import type { Thread, Theme, ThemeId } from "@/core/types";

export const dynamic = "force-dynamic";

export default async function ThreadsPage(props: {
  searchParams: Promise<{ theme?: string }>;
}) {
  const userCompany = await getUserCompany();
  if (!userCompany) redirect("/onboarding");

  const searchParams = await props.searchParams;

  const db = createServerClient();
  const threadRepo = createThreadRepo(db);

  const { data: themes } = await db
    .from("themes")
    .select("*")
    .eq("company_id", userCompany.companyId)
    .order("name", { ascending: true });

  const themeList = (themes ?? []) as Theme[];
  const themeMap = new Map(themeList.map((t) => [t.id, t]));

  const filters = searchParams.theme
    ? { theme_id: searchParams.theme as ThemeId }
    : undefined;

  let threads: Thread[];
  try {
    threads = await threadRepo.list(userCompany.companyId, filters);
  } catch {
    threads = [];
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Threads</h2>
        <div className="flex items-center gap-3">
          <ThemeFilter themes={themeList} />
          <Link
            href="/threads/new"
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
          >
            New Thread
          </Link>
        </div>
      </div>

      {threads.length === 0 ? (
        <p className="text-[var(--muted-foreground)] text-sm">
          No threads yet. Create one to get started, or apply the seed data.
        </p>
      ) : (
        <ul className="space-y-2">
          {threads.map((thread) => {
            const theme = thread.theme_id
              ? themeMap.get(thread.theme_id)
              : undefined;
            return (
              <li key={thread.id}>
                <Link
                  href={`/threads/${thread.id}`}
                  className="block rounded-lg border border-[var(--border)] p-4 hover:border-[var(--primary)] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{thread.title}</h3>
                    <div className="flex items-center gap-2">
                      {theme && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: theme.color
                              ? `${theme.color}20`
                              : undefined,
                            color: theme.color ?? undefined,
                          }}
                        >
                          {theme.name}
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
                        {thread.status}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    {new Date(thread.created_at).toLocaleDateString()}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
