"use client";

import { useState, useCallback, useRef, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ThreadWithLastMessage } from "@/app/threads/layout";
import { FormattedDate } from "./formatted-date";

const BATCH_SIZE = 100;
const PINNED_STORAGE_KEY = "threadops-pinned-threads";
const EXPANDED_GROUPS_KEY = "threadops-expanded-groups";

function readStorageSet(key: string): Set<string> {
  try {
    const stored = localStorage.getItem(key);
    return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function writeStorageSet(key: string, items: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...items]));
  } catch {
    // ignore
  }
}

function useStorageSet(key: string) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const handler = (e: StorageEvent) => { if (e.key === key) cb(); };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
    [key],
  );
  const getSnapshot = useCallback(() => localStorage.getItem(key), [key]);
  const getServerSnapshot = useCallback(() => null, []);
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  try {
    return raw ? (new Set(JSON.parse(raw) as string[])) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
] as const;

const GROUP_OPTIONS = [
  { value: "agent", label: "By agent" },
  { value: "timeline", label: "By timeline" },
] as const;

const AGENT_COLORS = [
  { bg: "#14B8A6", fg: "#ffffff" },
  { bg: "#0D9488", fg: "#ffffff" },
  { bg: "#0E7490", fg: "#ffffff" },
  { bg: "#1E6B5A", fg: "#ffffff" },
  { bg: "#115E59", fg: "#ffffff" },
  { bg: "#164E63", fg: "#ffffff" },
  { bg: "#2563EB", fg: "#ffffff" },
  { bg: "#1D4ED8", fg: "#ffffff" },
  { bg: "#0F766E", fg: "#ffffff" },
  { bg: "#0891B2", fg: "#ffffff" },
  { bg: "#1A7A6D", fg: "#ffffff" },
  { bg: "#0C6B5F", fg: "#ffffff" },
] as const;

function getAgentColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % AGENT_COLORS.length;
  return AGENT_COLORS[idx];
}

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
  agentsWithoutWebhooks?: string[];
}

function buildWebhookPrompt(agentName: string): string {
  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "https://threadops-jade.vercel.app";
  return `## Set Up Webhooks for ${agentName}

${agentName} is not receiving notifications when humans reply to threads. To fix this, register a webhook endpoint.

### Register a Webhook Endpoint

curl -X POST "${baseUrl}/api/webhook-endpoints" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://your-server.com/webhook",
    "events": ["message.created", "thread.created", "thread.status_changed"]
  }'

### Available Events
- \`message.created\` — fires when any new message is posted (most important for replies)
- \`thread.created\` — fires when a new thread is created
- \`thread.status_changed\` — fires when a thread is opened or archived

### Webhook Payload
Webhooks are signed with HMAC-SHA-256. The signing secret is returned when you create the endpoint. Verify the \`X-Webhook-Signature\` header on incoming requests.

**Without a webhook, ${agentName} must poll GET /api/threads to detect new messages.**`;
}

export function ThreadSidebar({
  initialThreads,
  companyId,
  agentsWithoutWebhooks = [],
}: ThreadSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const [extraThreads, setExtraThreads] = useState<ThreadWithLastMessage[]>([]);
  const [overrideThreads, setOverrideThreads] = useState<ThreadWithLastMessage[] | null>(null);
  const threads = [...(overrideThreads ?? initialThreads), ...extraThreads];
  const [status, setStatus] = useState("open");
  const [groupBy, setGroupBy] = useState("agent");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialThreads.length >= BATCH_SIZE);
  const storedPins = useStorageSet(PINNED_STORAGE_KEY);
  const storedExpanded = useStorageSet(EXPANDED_GROUPS_KEY);
  const [localExpandedOverrides, setLocalExpandedOverrides] = useState<Set<string> | null>(null);
  const expandedGroups = localExpandedOverrides ?? storedExpanded;
  const pinnedThreads = storedPins;
  const [menuThreadId, setMenuThreadId] = useState<string | null>(null);
  const [webhookPromptAgent, setWebhookPromptAgent] = useState<string | null>(null);
  const [webhookPromptCopied, setWebhookPromptCopied] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleMobileLinkClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("a")) {
      setMobileOpen(false);
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuThreadId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const togglePin = useCallback((threadId: string) => {
    const current = readStorageSet(PINNED_STORAGE_KEY);
    if (current.has(threadId)) {
      current.delete(threadId);
    } else {
      current.add(threadId);
    }
    writeStorageSet(PINNED_STORAGE_KEY, current);
    // Force re-render by dispatching storage event
    window.dispatchEvent(new StorageEvent("storage", { key: PINNED_STORAGE_KEY }));
    setMenuThreadId(null);
  }, []);

  const archiveThread = useCallback(async (threadId: string) => {
    setMenuThreadId(null);
    try {
      const res = await fetch(`/api/threads/${threadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived", company_id: companyId }),
      });
      if (res.ok) {
        setOverrideThreads((prev) => {
          const base = prev ?? initialThreads;
          return base.filter((t) => t.id !== threadId);
        });
        setExtraThreads((prev) => prev.filter((t) => t.id !== threadId));
      }
    } catch {
      // Silently handle
    }
  }, [companyId, initialThreads]);

  const toggleGroup = useCallback((label: string) => {
    const current = readStorageSet(EXPANDED_GROUPS_KEY);
    if (current.has(label)) {
      current.delete(label);
    } else {
      current.add(label);
    }
    writeStorageSet(EXPANDED_GROUPS_KEY, current);
    setLocalExpandedOverrides(new Set(current));
    window.dispatchEvent(new StorageEvent("storage", { key: EXPANDED_GROUPS_KEY }));
  }, []);

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
      setExtraThreads((prev) => [...prev, ...newThreads]);
      setHasMore(newThreads.length >= BATCH_SIZE);
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, threads.length, companyId, status, search]);

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

  const [searchResults, setSearchResults] = useState<Array<{ type: string; thread_id: string; thread_title?: string; highlight: string; message_id?: string }> | null>(null);

  const fetchThreads = useCallback(
    async (newStatus: string, newSearch: string) => {
      setLoading(true);
      setSearchResults(null);
      try {
        if (newSearch) {
          // Use full-text search API
          const params = new URLSearchParams();
          params.set("q", newSearch);
          params.set("scope", "all");
          params.set("per_page", "50");
          if (newStatus !== "all") params.set("status", newStatus);

          const res = await fetch(`/api/search?${params.toString()}`);
          if (res.ok) {
            const data = await res.json();
            setSearchResults(data.results ?? []);
          }
          // Also fetch threads with title search as fallback
          const threadParams = new URLSearchParams();
          threadParams.set("company_id", companyId);
          threadParams.set("limit", String(BATCH_SIZE));
          if (newStatus !== "all") threadParams.set("status", newStatus);
          threadParams.set("q", newSearch);

          const threadRes = await fetch(`/api/threads?${threadParams.toString()}`);
          if (!threadRes.ok) throw new Error("Failed to load threads");
          const threadData = (await threadRes.json()) as ThreadWithLastMessage[];
          setOverrideThreads(threadData);
          setExtraThreads([]);
          setHasMore(threadData.length >= BATCH_SIZE);
        } else {
          const params = new URLSearchParams();
          params.set("company_id", companyId);
          params.set("limit", String(BATCH_SIZE));
          if (newStatus !== "all") params.set("status", newStatus);

          const res = await fetch(`/api/threads?${params.toString()}`);
          if (!res.ok) throw new Error("Failed to load threads");
          const data = (await res.json()) as ThreadWithLastMessage[];
          setOverrideThreads(data);
          setExtraThreads([]);
          setHasMore(data.length >= BATCH_SIZE);
        }
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

  const filtered = search
    ? threads.filter((t) =>
        t.title.toLowerCase().includes(search.toLowerCase()),
      )
    : threads;

  let grouped: { label: string; threads: ThreadWithLastMessage[] }[];

  if (groupBy === "agent") {
    const agentBuckets = new Map<string, ThreadWithLastMessage[]>();
    const unassigned: ThreadWithLastMessage[] = [];
    for (const t of filtered) {
      const agent = t.agent_name;
      if (agent) {
        const existing = agentBuckets.get(agent) ?? [];
        existing.push(t);
        agentBuckets.set(agent, existing);
      } else {
        unassigned.push(t);
      }
    }
    grouped = [];
    for (const [agent, agentThreads] of agentBuckets) {
      grouped.push({ label: agent, threads: agentThreads });
    }
    grouped.sort((a, b) => a.label.localeCompare(b.label));
    if (unassigned.length > 0) {
      grouped.push({ label: "Unassigned", threads: unassigned });
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

  const activeThreadId = pathname.match(/\/threads\/([^/]+)/)?.[1];

  // Auto-expand: derive the group containing the active thread and merge it
  let activeGroupLabel: string | null = null;
  if (activeThreadId) {
    for (const group of grouped) {
      if (group.threads.some((t) => t.id === activeThreadId)) {
        activeGroupLabel = group.label;
        break;
      }
    }
  }
  const effectiveExpanded = activeGroupLabel && !expandedGroups.has(activeGroupLabel)
    ? new Set([...expandedGroups, activeGroupLabel])
    : expandedGroups;

  const isAccordion = groupBy === "agent";
  const hasAnyExpanded = !isAccordion || effectiveExpanded.size > 0;

  const sidebarContent = (
    <>
      <div className="p-3 border-b border-[var(--border)] space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Threads</h2>
          <Link
            href="/threads/new"
            className="px-2 py-1 text-xs font-medium rounded bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
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

      <div className="flex-1 overflow-y-auto">
        {searchResults && searchResults.length > 0 && (
          <div className="border-b border-[var(--border)]">
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] bg-[var(--muted)]">
              Message matches
            </div>
            {searchResults.filter((r) => r.type === "message").slice(0, 5).map((result) => (
              <Link
                key={result.message_id ?? result.thread_id}
                href={`/threads/${result.thread_id}`}
                className="block px-3 py-2 border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
              >
                <p className="text-xs text-[var(--muted-foreground)] line-clamp-2">
                  {result.highlight.replace(/\*\*/g, "")}
                </p>
              </Link>
            ))}
          </div>
        )}
        {filtered.length === 0 && !loading ? (
          <p className="text-xs text-[var(--muted-foreground)] p-3">
            No threads found.
          </p>
        ) : (
          grouped.map((group) => {
            const isOpen = effectiveExpanded.has(group.label);
            const color = isAccordion ? getAgentColor(group.label) : null;
            const sortedThreads = [...group.threads].sort((a, b) => {
              const aPinned = pinnedThreads.has(a.id) ? 0 : 1;
              const bPinned = pinnedThreads.has(b.id) ? 0 : 1;
              return aPinned - bPinned;
            });
            const visibleThreads = isAccordion && isOpen
              ? sortedThreads
              : isAccordion
                ? []
                : sortedThreads;
            const missingWebhook = isAccordion && group.label !== "Unassigned" && agentsWithoutWebhooks.includes(group.label);

            return (
              <div key={group.label}>
                {isAccordion ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:opacity-90"
                    style={{
                      backgroundColor: color?.bg,
                      color: color?.fg,
                    }}
                  >
                    <svg
                      className={`w-3 h-3 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-xs font-semibold truncate">
                      {group.label}
                    </span>
                    {missingWebhook && (
                      <span
                        title="No webhook registered"
                        className="shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setWebhookPromptAgent(group.label);
                        }}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </span>
                    )}
                    <span
                      className="ml-auto text-[10px] font-medium rounded-full px-1.5 py-0.5 shrink-0"
                      style={{
                        backgroundColor: color ? `${color.fg}22` : undefined,
                        color: color?.fg,
                      }}
                    >
                      {group.threads.length}
                    </span>
                  </button>
                ) : (
                  <div className="sticky top-0 z-10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] bg-[var(--muted)]">
                    {group.label}
                  </div>
                )}

                {(isAccordion ? isOpen : true) && (
                  <div>
                    {visibleThreads.map((thread) => {
                      const isActive = thread.id === activeThreadId;
                      const isPinned = pinnedThreads.has(thread.id);
                      return (
                        <div key={thread.id} className="relative group">
                          <Link
                            href={`/threads/${thread.id}`}
                            className={`block px-3 py-2 border-b border-[var(--border)] transition-colors ${
                              isActive
                                ? "bg-[var(--accent)]/15 border-l-2 border-l-[var(--accent)] text-[var(--foreground)]"
                                : "hover:bg-[var(--muted)]"
                            }`}
                          >
                            <div className="flex items-start gap-1">
                              {isPinned && (
                                <svg className="w-3 h-3 shrink-0 mt-0.5 text-[var(--primary)]" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                                </svg>
                              )}
                              <h3
                                className={`text-sm leading-tight flex-1 ${isActive ? "font-semibold" : "font-medium"}`}
                              >
                                {thread.title}
                              </h3>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setMenuThreadId(menuThreadId === thread.id ? null : thread.id);
                                }}
                                className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--muted)] transition-opacity"
                              >
                                <svg className="w-4 h-4 text-[var(--muted-foreground)]" fill="currentColor" viewBox="0 0 24 24">
                                  <circle cx="12" cy="5" r="1.5" />
                                  <circle cx="12" cy="12" r="1.5" />
                                  <circle cx="12" cy="19" r="1.5" />
                                </svg>
                              </button>
                            </div>
                            {thread.summary && (
                              <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5 line-clamp-1">
                                {thread.summary}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {thread.last_author_kind === "agent" ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-medium">
                                  Needs reply
                                </span>
                              ) : thread.last_author_kind === "user" ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                  Replied
                                </span>
                              ) : null}
                              {thread.tags && thread.tags.length > 0 && thread.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                                  {tag}
                                </span>
                              ))}
                              {thread.tags && thread.tags.length > 3 && (
                                <span className="text-[10px] text-[var(--muted-foreground)]">
                                  +{thread.tags.length - 3}
                                </span>
                              )}
                              <span className="text-[10px] text-[var(--muted-foreground)]">
                                <FormattedDate
                                  date={thread.last_message_at ?? thread.created_at}
                                />
                              </span>
                            </div>
                          </Link>
                          {menuThreadId === thread.id && (
                            <div
                              ref={menuRef}
                              className="absolute right-2 top-8 z-20 bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg py-1 min-w-[140px]"
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  togglePin(thread.id);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--muted)] transition-colors text-left"
                              >
                                <svg className="w-3.5 h-3.5" fill={isPinned ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isPinned ? 0 : 2}>
                                  <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                                </svg>
                                {isPinned ? "Unpin thread" : "Pin to top"}
                              </button>
                              {thread.status === "open" && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    archiveThread(thread.id);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--muted)] transition-colors text-left text-amber-400"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                  </svg>
                                  Archive
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}

        {hasAnyExpanded && <div ref={sentinelRef} className="h-8" />}

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

      {webhookPromptAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <h3 className="text-sm font-semibold">
                  {webhookPromptAgent} needs webhooks
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setWebhookPromptAgent(null); setWebhookPromptCopied(false); }}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <p className="text-xs text-[var(--muted-foreground)] mb-3">
                This agent has no webhook endpoint registered. Without webhooks, it must poll for new messages.
                Copy the prompt below and give it to your agent.
              </p>
              <pre className="text-xs font-mono bg-[var(--muted)] rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">
                {buildWebhookPrompt(webhookPromptAgent)}
              </pre>
            </div>
            <div className="p-4 border-t border-[var(--border)] flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(buildWebhookPrompt(webhookPromptAgent));
                  setWebhookPromptCopied(true);
                  setTimeout(() => setWebhookPromptCopied(false), 2000);
                }}
                className="flex-1 px-3 py-1.5 text-sm font-medium rounded bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
              >
                {webhookPromptCopied ? "Copied!" : "Copy Prompt"}
              </button>
              <button
                type="button"
                onClick={() => { setWebhookPromptAgent(null); setWebhookPromptCopied(false); }}
                className="px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed bottom-4 right-4 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] shadow-lg hover:opacity-90 transition-opacity"
        aria-label="Open threads"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
        </svg>
        <span className="text-sm font-medium">Threads</span>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="absolute inset-y-0 left-0 w-[85vw] max-w-sm flex flex-col bg-[var(--background)] shadow-xl z-50"
            onClick={handleMobileLinkClick}
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-2 left-2 z-10 p-1.5 rounded-md hover:bg-[var(--muted)] transition-colors"
              aria-label="Close threads"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar — only render content when mobile overlay is closed to avoid shared ref conflicts */}
      <aside className="hidden md:flex w-80 lg:w-96 border-r border-[var(--border)] flex-col bg-[var(--background)] shrink-0 overflow-hidden">
        {!mobileOpen && sidebarContent}
      </aside>
    </>
  );
}
