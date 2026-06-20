"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ThreadWithLastMessage } from "@/app/threads/layout";
import { FormattedDate } from "./formatted-date";

const BATCH_SIZE = 100;
const DEFAULT_VISIBLE_THREADS = 10;

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
] as const;

const GROUP_OPTIONS = [
  { value: "agent", label: "By agent" },
  { value: "timeline", label: "By timeline" },
] as const;

const AGENT_COLORS = [
  { bg: "#6366f1", fg: "#ffffff" },
  { bg: "#ec4899", fg: "#ffffff" },
  { bg: "#14b8a6", fg: "#ffffff" },
  { bg: "#f59e0b", fg: "#1a1a1a" },
  { bg: "#8b5cf6", fg: "#ffffff" },
  { bg: "#06b6d4", fg: "#ffffff" },
  { bg: "#ef4444", fg: "#ffffff" },
  { bg: "#10b981", fg: "#ffffff" },
  { bg: "#f97316", fg: "#1a1a1a" },
  { bg: "#3b82f6", fg: "#ffffff" },
  { bg: "#d946ef", fg: "#ffffff" },
  { bg: "#84cc16", fg: "#1a1a1a" },
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
- \`thread.status_changed\` — fires when a thread is opened, closed, or archived

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

  const [threads, setThreads] = useState(initialThreads);
  const [status, setStatus] = useState("open");
  const [groupBy, setGroupBy] = useState("agent");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialThreads.length >= BATCH_SIZE);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showAllGroups, setShowAllGroups] = useState<Set<string>>(new Set());
  const [webhookPromptAgent, setWebhookPromptAgent] = useState<string | null>(null);
  const [webhookPromptCopied, setWebhookPromptCopied] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const toggleGroup = useCallback((label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }, []);

  const toggleShowAll = useCallback((label: string) => {
    setShowAllGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
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
      setThreads((prev) => [...prev, ...newThreads]);
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

  const isAccordion = groupBy === "agent";
  const hasAnyExpanded = !isAccordion || expandedGroups.size > 0;

  return (
    <aside className="w-80 lg:w-96 border-r border-[var(--border)] flex flex-col bg-[var(--background)] shrink-0 overflow-hidden">
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

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && !loading ? (
          <p className="text-xs text-[var(--muted-foreground)] p-3">
            No threads found.
          </p>
        ) : (
          grouped.map((group) => {
            const isOpen = expandedGroups.has(group.label);
            const color = isAccordion ? getAgentColor(group.label) : null;
            const showAll = showAllGroups.has(group.label);
            const maxVisible = showAll ? group.threads.length : DEFAULT_VISIBLE_THREADS;
            const visibleThreads = isAccordion && isOpen
              ? group.threads.slice(0, maxVisible)
              : isAccordion
                ? []
                : group.threads;
            const hasOverflow = isAccordion && group.threads.length > DEFAULT_VISIBLE_THREADS;
            const missingWebhook = isAccordion && group.label !== "You" && agentsWithoutWebhooks.includes(group.label);

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
                  <div
                    className={isAccordion && hasOverflow ? "max-h-[440px] overflow-y-auto" : ""}
                  >
                    {visibleThreads.map((thread) => {
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
                          <h3
                            className={`text-sm leading-tight ${isActive ? "font-semibold" : "font-medium"}`}
                          >
                            {thread.title}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-1">
                            {thread.last_author_kind === "agent" ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-medium">
                                Needs reply
                              </span>
                            ) : thread.last_author_kind === "user" ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                Replied
                              </span>
                            ) : null}
                            <span className="text-[10px] text-[var(--muted-foreground)]">
                              <FormattedDate
                                date={thread.last_message_at ?? thread.created_at}
                              />
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                    {isAccordion && hasOverflow && (
                      <button
                        type="button"
                        onClick={() => toggleShowAll(group.label)}
                        className="w-full px-3 py-1.5 text-[10px] text-[var(--primary)] hover:underline text-left"
                      >
                        {showAll
                          ? "Show less"
                          : `+${group.threads.length - DEFAULT_VISIBLE_THREADS} more threads`}
                      </button>
                    )}
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
                className="flex-1 px-3 py-1.5 text-sm font-medium rounded bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
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
    </aside>
  );
}
