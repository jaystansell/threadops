"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ThreadWithLastMessage } from "@/app/threads/layout";
import { FormattedDate } from "./formatted-date";

const BATCH_SIZE = 100;

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
] as const;

const GROUP_OPTIONS = [
  { value: "timeline", label: "By timeline" },
  { value: "agent", label: "By agent" },
] as const;

function getTimelineGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  if (date >= startOfToday) return "Today";

  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  if (date >= startOfWeek) return "This Week";

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (date >= startOfMonth) return "This Month";

  const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
  const startOfQuarter = new Date(now.getFullYear(), quarterMonth, 1);
  if (date >= startOfQuarter) return "This Quarter";

  return "Older";
}

const TIMELINE_ORDER = [
  "Today",
  "This Week",
  "This Month",
  "This Quarter",
  "Older",
];

interface ThreadSidebarProps {
  initialThreads: ThreadWithLastMessage[];
  companyId: string;
}

export function ThreadSidebar({
  initialThreads,
  companyId,
}: ThreadSidebarProps) {
  const pathname = usePathname();

  const [threads, setThreads] =
    useState(initialThreads);
  const [status, setStatus] = useState("open");
  const [groupBy, setGroupBy] = useState("timeline");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialThreads.length >= BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("company_id", companyId);
      params.set("offset", String(threads.length));
      params.set("limit", String(BATCH_SIZE));
      if (status !== "all") params.set("status", status);
      if (search) params.set("q", search);

      const res = await fetch(`/api/threads?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load threads");
      const newThreads = (await res.json()) as ThreadWithLastMessage[];
      setThreads((prev) => [...prev, ...newThreads]);
      setHasMore(newThreads.length >= BATCH_SIZE);
    } catch {
      // Silently handle — user can scroll again
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, threads.length, companyId, status, search]);

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // Re-fetch when status or search changes
  const fetchThreads = useCallback(
    async (newStatus: string, newSearch: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("company_id", companyId);
        params.set("limit", String(BATCH_SIZE));
        if (newStatus !== "all") params.set("status", newStatus);
        if (newSearch) params.set("q", newSearch);

        const res = await fetch(`/api/threads?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load threads");
        const data = (await res.json()) as ThreadWithLastMessage[];
        setThreads(data);
        setHasMore(data.length >= BATCH_SIZE);
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    },
    [companyId],
  );

  function handleStatusChange(newStatus: string) {
    setStatus(newStatus);
    fetchThreads(newStatus, search);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchThreads(status, search);
  }

  // Filter threads client-side by search (for immediate feedback)
  const filtered = search
    ? threads.filter((t) =>
        t.title.toLowerCase().includes(search.toLowerCase()),
      )
    : threads;

  // Group threads
  let grouped: { label: string; threads: ThreadWithLastMessage[] }[];

  if (groupBy === "agent") {
    const agentMap = new Map<string, ThreadWithLastMessage[]>();
    const noAgent: ThreadWithLastMessage[] = [];
    for (const t of filtered) {
      if (t.last_author_kind === "agent" && t.last_author_name) {
        const existing = agentMap.get(t.last_author_name) ?? [];
        existing.push(t);
        agentMap.set(t.last_author_name, existing);
      } else {
        noAgent.push(t);
      }
    }
    grouped = [];
    for (const [agent, agentThreads] of agentMap) {
      grouped.push({ label: agent, threads: agentThreads });
    }
    grouped.sort((a, b) => a.label.localeCompare(b.label));
    if (noAgent.length > 0) {
      grouped.push({ label: "No agent", threads: noAgent });
    }
  } else {
    const buckets = new Map<string, ThreadWithLastMessage[]>();
    for (const t of filtered) {
      const dateToUse = t.last_message_at ?? t.created_at;
      const group = getTimelineGroup(dateToUse);
      const existing = buckets.get(group) ?? [];
      existing.push(t);
      buckets.set(group, existing);
    }
    grouped = TIMELINE_ORDER.filter((label) => buckets.has(label)).map(
      (label) => ({
        label,
        threads: buckets.get(label)!,
      }),
    );
  }

  // Extract active thread ID from pathname
  const activeThreadId = pathname.match(/\/threads\/([^/]+)/)?.[1];

  return (
    <aside className="w-80 lg:w-96 border-r border-[var(--border)] flex flex-col bg-[var(--background)] shrink-0 overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-[var(--border)] space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Threads</h2>
          <Link
            href="/threads/new"
            className="px-2 py-1 text-xs font-medium rounded bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
          >
            New
          </Link>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex gap-1">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="flex-1 px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--background)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)]"
          />
        </form>

        <div className="flex gap-1">
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-1 py-0.5 text-xs focus:outline-none focus:border-[var(--primary)]"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-1 py-0.5 text-xs focus:outline-none focus:border-[var(--primary)]"
          >
            {GROUP_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && !loading ? (
          <p className="text-xs text-[var(--muted-foreground)] p-3">
            No threads found.
          </p>
        ) : (
          grouped.map((group) => (
            <div key={group.label}>
              <div className="sticky top-0 z-10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] bg-[var(--muted)]">
                {group.label}
              </div>
              {group.threads.map((thread) => {
                const isActive = thread.id === activeThreadId;
                return (
                  <Link
                    key={thread.id}
                    href={`/threads/${thread.id}`}
                    className={`block px-3 py-2 border-b border-[var(--border)] transition-colors ${
                      isActive
                        ? "bg-[var(--primary)] bg-opacity-10 border-l-2 border-l-[var(--primary)]"
                        : "hover:bg-[var(--muted)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <h3
                        className={`text-sm leading-tight ${isActive ? "font-semibold" : "font-medium"}`}
                      >
                        {thread.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {thread.last_author_kind && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            thread.last_author_kind === "agent"
                              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                              : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                          }`}
                        >
                          {thread.last_author_kind === "agent"
                            ? (thread.last_author_name ?? "Agent")
                            : "You"}
                        </span>
                      )}
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        <FormattedDate
                          date={thread.last_message_at ?? thread.created_at}
                        />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ))
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-8" />

        {loading && (
          <div className="p-3 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-lg bg-[var(--muted)] h-14"
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
