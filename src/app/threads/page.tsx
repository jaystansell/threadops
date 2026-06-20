import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/adapters/supabase/client";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { ThemeFilter } from "@/app/_components/theme-filter";
import { StatusFilter } from "@/app/_components/status-filter";
import { SearchBar } from "@/app/_components/search-bar";
import type { Thread, Theme, ThemeId, ThreadStatus } from "@/core/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Threads" };

const PAGE_SIZE = 10;

const VALID_STATUSES: ThreadStatus[] = ["open", "closed", "archived"];

export default async function ThreadsPage(props: {
  searchParams: Promise<{ theme?: string; q?: string; page?: string; status?: string }>;
}) {
  const userCompany = await getUserCompany();
  if (!userCompany) redirect("/onboarding");

  const searchParams = await props.searchParams;
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const searchQuery = searchParams.q?.trim() ?? "";
  const statusParam = searchParams.status ?? "open";
  const statusFilter = VALID_STATUSES.includes(statusParam as ThreadStatus)
    ? (statusParam as ThreadStatus)
    : null;

  const db = createServerClient();

  const { data: themes, error: themesError } = await db
    .from("themes")
    .select("*")
    .eq("company_id", userCompany.companyId)
    .order("name", { ascending: true });
  if (themesError) throw themesError;

  const themeList = (themes ?? []) as Theme[];
  const themeMap = new Map(themeList.map((t) => [t.id, t]));

  let query = db
    .from("threads")
    .select("*", { count: "exact" })
    .eq("company_id", userCompany.companyId)
    .order("created_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }
  if (searchParams.theme) {
    query = query.eq("theme_id", searchParams.theme as ThemeId);
  }
  if (searchQuery) {
    const escaped = searchQuery.replace(/[%_\\]/g, "\\$&");
    query = query.ilike("title", `%${escaped}%`);
  }

  query = query.range(offset, offset + PAGE_SIZE - 1);

  const { data, count, error } = await query;
  if (error) throw error;
  const threads = (data ?? []) as Thread[];
  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Build pagination href preserving current filters
  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (statusParam && statusParam !== "open") params.set("status", statusParam);
    if (searchParams.theme) params.set("theme", searchParams.theme);
    if (searchQuery) params.set("q", searchQuery);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/threads${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold">Threads</h2>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <StatusFilter />
          <ThemeFilter themes={themeList} />
          <Link
            href="/threads/new"
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
          >
            New Thread
          </Link>
        </div>
      </div>

      <SearchBar defaultValue={searchQuery} />

      {threads.length === 0 ? (
        <p className="text-[var(--muted-foreground)] text-sm">
          {searchQuery
            ? `No threads matching "${searchQuery}".`
            : statusFilter
              ? `No ${statusFilter} threads.`
              : "No threads yet. Create one to get started, or apply the seed data."}
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {threads.map((thread) => {
              const theme = thread.theme_id
                ? themeMap.get(thread.theme_id)
                : undefined;
              return (
                <li key={thread.id}>
                  <Link
                    href={`/threads/${thread.id}`}
                    className="block rounded-lg border border-[var(--border)] p-3 sm:p-4 hover:border-[var(--primary)] transition-colors"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
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

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              {page > 1 && (
                <Link
                  href={pageHref(page - 1)}
                  className="px-3 py-1 text-sm rounded border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
                >
                  Previous
                </Link>
              )}
              <span className="text-sm text-[var(--muted-foreground)]">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={pageHref(page + 1)}
                  className="px-3 py-1 text-sm rounded border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
                >
                  Next
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
