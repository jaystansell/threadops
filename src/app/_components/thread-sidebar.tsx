"use client";

import { useState, useCallback, useRef, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ThreadWithLastMessage, AgentGroup, AgentKeyInfo } from "@/app/threads/layout";
import { FormattedDate } from "./formatted-date";
import { ManageGroupsModal, GROUP_COLOR_MAP } from "./manage-groups-modal";
import { ResizableSidebar } from "./resizable-sidebar";
import { useMobileMenu } from "./mobile-menu-context";

const BATCH_SIZE = 100;
const PINNED_STORAGE_KEY = "threadops-pinned-threads";
const EXPANDED_GROUPS_KEY = "threadops-expanded-groups";
const AGENT_COLORS_KEY = "threadops-agent-colors";
const STATUS_FILTER_KEY = "threadops-status-filter";
const GROUP_BY_KEY = "threadops-group-by";

function readStorageString(key: string, fallback: string): string {
  try {
    return typeof window !== "undefined" ? (localStorage.getItem(key) ?? fallback) : fallback;
  } catch { return fallback; }
}

function writeStorageString(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

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

function useStorageRecord(key: string): Record<string, string> {
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
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
] as const;

const GROUP_OPTIONS = [
  { value: "agent", label: "By agent" },
  { value: "group", label: "By group" },
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

const PALETTE: { label: string; bg: string; fg: string }[] = [
  { label: "Teal", bg: "#14B8A6", fg: "#ffffff" },
  { label: "Deep Teal", bg: "#0D9488", fg: "#ffffff" },
  { label: "Cyan", bg: "#0891B2", fg: "#ffffff" },
  { label: "Ocean", bg: "#0E7490", fg: "#ffffff" },
  { label: "Blue", bg: "#2563EB", fg: "#ffffff" },
  { label: "Indigo", bg: "#4F46E5", fg: "#ffffff" },
  { label: "Purple", bg: "#7C3AED", fg: "#ffffff" },
  { label: "Violet", bg: "#8B5CF6", fg: "#ffffff" },
  { label: "Emerald", bg: "#059669", fg: "#ffffff" },
  { label: "Forest", bg: "#1E6B5A", fg: "#ffffff" },
  { label: "Amber", bg: "#D97706", fg: "#ffffff" },
  { label: "Rose", bg: "#E11D48", fg: "#ffffff" },
  { label: "Slate", bg: "#475569", fg: "#ffffff" },
  { label: "Charcoal", bg: "#1E293B", fg: "#ffffff" },
];

function readAgentColorOverrides(): Record<string, string> {
  try {
    const stored = localStorage.getItem(AGENT_COLORS_KEY);
    return stored ? (JSON.parse(stored) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeAgentColorOverride(agentName: string, bg: string) {
  try {
    const current = readAgentColorOverrides();
    current[agentName] = bg;
    localStorage.setItem(AGENT_COLORS_KEY, JSON.stringify(current));
    window.dispatchEvent(new StorageEvent("storage", { key: AGENT_COLORS_KEY }));
  } catch {
    // ignore
  }
}

function clearAgentColorOverride(agentName: string) {
  try {
    const current = readAgentColorOverrides();
    delete current[agentName];
    localStorage.setItem(AGENT_COLORS_KEY, JSON.stringify(current));
    window.dispatchEvent(new StorageEvent("storage", { key: AGENT_COLORS_KEY }));
  } catch {
    // ignore
  }
}

function getAgentColor(name: string, overrides?: Record<string, string>) {
  const overrideBg = overrides?.[name];
  if (overrideBg) {
    const match = PALETTE.find((p) => p.bg === overrideBg);
    if (match) return { bg: match.bg, fg: match.fg };
  }
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
  agentGroups?: AgentGroup[];
  agentKeys?: AgentKeyInfo[];
  revokedKeyIds?: string[];
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
  agentGroups: initialAgentGroups = [],
  agentKeys = [],
  revokedKeyIds: revokedKeyIdsProp = [],
}: ThreadSidebarProps) {
  const revokedKeyIds = new Set(revokedKeyIdsProp);

  // Live-updating webhook status — auto-clears warnings when agents register endpoints
  const [missingWebhookAgents, setMissingWebhookAgents] = useState<string[]>(agentsWithoutWebhooks);
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch("/api/webhook-endpoints");
        if (!res.ok || cancelled) return;
        const endpoints = (await res.json()) as Array<{ api_key_id: string | null; active: boolean }>;
        const activeKeyIds = new Set(
          endpoints.filter((ep) => ep.active).map((ep) => ep.api_key_id).filter(Boolean),
        );
        const missing = agentKeys
          .filter((k) => !k.revoked && !activeKeyIds.has(k.id))
          .map((k) => k.label);
        if (!cancelled) setMissingWebhookAgents(missing);
      } catch { /* ignore fetch errors */ }
    }
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [agentKeys]);
  // Build agent label → revoked lookup (only mark as revoked if ALL keys with that label are revoked)
  const labelToAllRevoked = new Map<string, boolean>();
  for (const k of agentKeys) {
    const prev = labelToAllRevoked.get(k.label);
    if (prev === false) continue; // already has an active key
    labelToAllRevoked.set(k.label, revokedKeyIds.has(k.id));
  }
  const revokedAgentNames = new Set(
    [...labelToAllRevoked.entries()].filter(([, allRevoked]) => allRevoked).map(([label]) => label),
  );
  const pathname = usePathname();
  const router = useRouter();
  const { portalTarget } = useMobileMenu();

  const [extraThreads, setExtraThreads] = useState<ThreadWithLastMessage[]>([]);
  const [overrideThreads, setOverrideThreads] = useState<ThreadWithLastMessage[] | null>(null);
  const threads = [...(overrideThreads ?? initialThreads), ...extraThreads];
  const [status, setStatusRaw] = useState(() => readStorageString(STATUS_FILTER_KEY, "open"));
  const setStatus = useCallback((v: string) => { setStatusRaw(v); writeStorageString(STATUS_FILTER_KEY, v); }, []);
  const [groupBy, setGroupByRaw] = useState(() => readStorageString(GROUP_BY_KEY, "agent"));
  const setGroupBy = useCallback((v: string) => { setGroupByRaw(v); writeStorageString(GROUP_BY_KEY, v); }, []);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialThreads.length >= BATCH_SIZE);
  const storedPins = useStorageSet(PINNED_STORAGE_KEY);
  const storedExpanded = useStorageSet(EXPANDED_GROUPS_KEY);
  const [localExpandedOverrides, setLocalExpandedOverrides] = useState<Set<string> | null>(null);
  const expandedGroups = localExpandedOverrides ?? storedExpanded;
  const pinnedThreads = storedPins;
  const [menuThreadId, setMenuThreadId] = useState<string | null>(null);
  const [colorPickerAgent, setColorPickerAgent] = useState<string | null>(null);
  const [webhookPromptAgent, setWebhookPromptAgent] = useState<string | null>(null);
  const [webhookPromptCopied, setWebhookPromptCopied] = useState(false);
  const [showManageGroups, setShowManageGroups] = useState(false);
  const [agentGroups, setAgentGroups] = useState<AgentGroup[]>(initialAgentGroups);
  const [expandedSubGroups, setExpandedSubGroups] = useState<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollRef = useRef(0);
  const agentColorOverrides = useStorageRecord(AGENT_COLORS_KEY);

  // Preserve sidebar scroll position across thread navigations
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    // Restore saved scroll position after route change renders
    requestAnimationFrame(() => {
      el.scrollTop = savedScrollRef.current;
    });
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuThreadId(null);
      }
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setColorPickerAgent(null);
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
        const viewingArchived = pathname.includes(`/threads/${threadId}`);
        if (viewingArchived) {
          router.push("/threads");
        }
        router.refresh();
      }
    } catch {
      // Silently handle
    }
  }, [companyId, initialThreads, pathname, router]);

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

  const toggleSubGroup = useCallback((key: string) => {
    setExpandedSubGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
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

  // On mount, if persisted status differs from server default ("open"), fetch matching threads
  const mountFetchedRef = useRef(false);
  useEffect(() => {
    if (mountFetchedRef.current) return;
    mountFetchedRef.current = true;
    const savedStatus = readStorageString(STATUS_FILTER_KEY, "open");
    if (savedStatus !== "open") {
      // Defer to avoid synchronous setState inside effect
      queueMicrotask(() => fetchThreads(savedStatus, ""));
    }
  }, [fetchThreads]);

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

  let grouped: { label: string; threads: ThreadWithLastMessage[]; groupColor?: string; subGroups?: { label: string; threads: ThreadWithLastMessage[] }[] }[];

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
  } else if (groupBy === "group") {
    // Build keyId→groupName map
    const keyIdToGroup = new Map<string, string>();
    for (const g of agentGroups) {
      for (const kid of g.agent_key_ids) {
        keyIdToGroup.set(kid, g.name);
      }
    }
    // Also map agentName→groupName via keyId
    const agentNameToGroup = new Map<string, string>();
    for (const k of agentKeys) {
      const gName = keyIdToGroup.get(k.id);
      if (gName) agentNameToGroup.set(k.label, gName);
    }

    const groupBuckets = new Map<string, ThreadWithLastMessage[]>();
    const ungrouped: ThreadWithLastMessage[] = [];
    for (const t of filtered) {
      // Try to match thread to a group via agent_api_key_id or agent_name
      let gName: string | undefined;
      if (t.agent_api_key_id) {
        gName = keyIdToGroup.get(t.agent_api_key_id);
      }
      if (!gName && t.agent_name) {
        gName = agentNameToGroup.get(t.agent_name);
      }
      if (gName) {
        const existing = groupBuckets.get(gName) ?? [];
        existing.push(t);
        groupBuckets.set(gName, existing);
      } else {
        ungrouped.push(t);
      }
    }

    // Maintain sort order from agentGroups, build per-agent sub-groups
    function buildSubGroups(threads: ThreadWithLastMessage[]): { label: string; threads: ThreadWithLastMessage[] }[] {
      const agentBuckets = new Map<string, ThreadWithLastMessage[]>();
      const noAgent: ThreadWithLastMessage[] = [];
      for (const t of threads) {
        const agentName = t.agent_name ?? (t.agent_api_key_id ? agentKeys.find((k) => k.id === t.agent_api_key_id)?.label : undefined);
        if (agentName) {
          const existing = agentBuckets.get(agentName) ?? [];
          existing.push(t);
          agentBuckets.set(agentName, existing);
        } else {
          noAgent.push(t);
        }
      }
      const subs: { label: string; threads: ThreadWithLastMessage[] }[] = [];
      for (const [agent, agentThreads] of agentBuckets) {
        subs.push({ label: agent, threads: agentThreads });
      }
      subs.sort((a, b) => a.label.localeCompare(b.label));
      if (noAgent.length > 0) {
        subs.push({ label: "Unassigned", threads: noAgent });
      }
      return subs;
    }

    grouped = agentGroups
      .filter((g) => groupBuckets.has(g.name))
      .map((g) => {
        const threads = groupBuckets.get(g.name)!;
        return {
          label: g.name,
          threads,
          groupColor: g.color,
          subGroups: buildSubGroups(threads),
        };
      });
    if (ungrouped.length > 0) {
      const ug = ungrouped;
      grouped.push({ label: "Ungrouped", threads: ug, subGroups: buildSubGroups(ug) });
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

  // Auto-expand sub-group containing active thread (derived, no setState)
  let activeSubKey: string | null = null;
  if (activeThreadId && groupBy === "group") {
    for (const group of grouped) {
      if (group.subGroups) {
        for (const sub of group.subGroups) {
          if (sub.threads.some((t) => t.id === activeThreadId)) {
            activeSubKey = `${group.label}::${sub.label}`;
            break;
          }
        }
      }
      if (activeSubKey) break;
    }
  }
  const effectiveSubExpanded = activeSubKey && !expandedSubGroups.has(activeSubKey)
    ? new Set([...expandedSubGroups, activeSubKey])
    : expandedSubGroups;

  const isAccordion = groupBy === "agent" || groupBy === "group";
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
            className="flex-1 px-2 py-1 text-[16px] sm:text-xs rounded border border-[var(--border)] bg-[var(--background)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)]"
          />
        </form>

        <div className="flex gap-1">
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-1 py-0.5 text-[16px] sm:text-xs focus:outline-none focus:border-[var(--primary)]"
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
            className="flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-1 py-0.5 text-[16px] sm:text-xs focus:outline-none focus:border-[var(--primary)]"
          >
            {GROUP_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {groupBy === "group" && (
          <button
            type="button"
            onClick={() => setShowManageGroups(true)}
            className="w-full px-2 py-1 text-[10px] font-medium rounded border border-dashed border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--foreground)] transition-colors"
          >
            Manage Groups
          </button>
        )}
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
        onScroll={(e) => { savedScrollRef.current = e.currentTarget.scrollTop; }}
      >
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
        ) : groupBy === "group" && agentGroups.length === 0 ? (
          <div className="p-4 text-center space-y-2">
            <p className="text-xs text-[var(--muted-foreground)]">
              No groups created yet.
            </p>
            <button
              type="button"
              onClick={() => setShowManageGroups(true)}
              className="px-3 py-1.5 text-xs font-medium rounded bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
            >
              Create Your First Group
            </button>
          </div>
        ) : (
          grouped.map((group) => {
            const isOpen = effectiveExpanded.has(group.label);
            const color = isAccordion
              ? (group.groupColor
                  ? (GROUP_COLOR_MAP[group.groupColor] ?? getAgentColor(group.label, agentColorOverrides))
                  : getAgentColor(group.label, agentColorOverrides))
              : null;
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
            const missingWebhook = groupBy === "agent" && isAccordion && group.label !== "Unassigned" && missingWebhookAgents.includes(group.label);
            const isRevoked = groupBy === "agent" && revokedAgentNames.has(group.label);

            return (
              <div key={group.label}>
                {isAccordion ? (
                  <div
                    className={`relative flex items-center transition-colors hover:opacity-90 ${colorPickerAgent === group.label ? "z-40" : ""} ${isRevoked ? "opacity-50" : ""}`}
                    style={{
                      backgroundColor: color?.bg,
                      color: color?.fg,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.label)}
                      className="flex-1 flex items-center gap-2 px-3 py-2 text-left"
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
                      <span className={`text-xs font-semibold truncate uppercase ${isRevoked ? "line-through" : ""}`}>
                        {group.label}
                      </span>
                      {isRevoked && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-900/60 text-red-300 font-medium shrink-0 no-underline">
                          Disconnected
                        </span>
                      )}
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
                    {groupBy === "agent" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setColorPickerAgent(colorPickerAgent === group.label ? null : group.label);
                        }}
                        className="shrink-0 p-1.5 mr-1 rounded hover:bg-white/20 transition-colors"
                        title="Change color"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="5" r="1.5" />
                          <circle cx="12" cy="12" r="1.5" />
                          <circle cx="12" cy="19" r="1.5" />
                        </svg>
                      </button>
                    )}
                    {colorPickerAgent === group.label && (
                      <div
                        ref={colorPickerRef}
                        className="absolute right-0 top-full z-50 bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-xl py-2 px-2 w-[200px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5 px-1">
                          Header color
                        </p>
                        <div className="grid grid-cols-7 gap-1">
                          {PALETTE.map((p) => {
                            const isSelected = agentColorOverrides[group.label] === p.bg;
                            return (
                              <button
                                key={p.bg}
                                type="button"
                                title={p.label}
                                onClick={() => {
                                  writeAgentColorOverride(group.label, p.bg);
                                  setColorPickerAgent(null);
                                }}
                                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                                  isSelected ? "border-white ring-2 ring-[var(--primary)]" : "border-transparent"
                                }`}
                                style={{ backgroundColor: p.bg }}
                              />
                            );
                          })}
                        </div>
                        {agentColorOverrides[group.label] && (
                          <button
                            type="button"
                            onClick={() => {
                              clearAgentColorOverride(group.label);
                              setColorPickerAgent(null);
                            }}
                            className="mt-2 w-full text-[10px] text-center py-1 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)] transition-colors"
                          >
                            Reset to default
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="sticky top-0 z-10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] bg-[var(--muted)]">
                    {group.label}
                  </div>
                )}

                {isAccordion && isOpen && missingWebhook && (
                  <div className="px-3 py-2 bg-amber-900/30 border-b border-amber-700/40">
                    <div className="flex items-start gap-2">
                      <svg className="w-3.5 h-3.5 mt-0.5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-amber-300 font-medium">
                          No webhook registered — this agent won&apos;t receive notifications.
                        </p>
                        <button
                          type="button"
                          onClick={() => setWebhookPromptAgent(group.label)}
                          className="text-[10px] text-amber-400 underline hover:text-amber-200 mt-0.5"
                        >
                          Copy setup instructions
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {(isAccordion ? isOpen : true) && (
                  <div>
                    {groupBy === "group" && group.subGroups ? (
                      group.subGroups.map((sub) => {
                        const subKey = `${group.label}::${sub.label}`;
                        const subOpen = effectiveSubExpanded.has(subKey);
                        const subColor = getAgentColor(sub.label, agentColorOverrides);
                        const subRevoked = revokedAgentNames.has(sub.label);
                        const subSorted = [...sub.threads].sort((a, b) => {
                          const ap = pinnedThreads.has(a.id) ? 0 : 1;
                          const bp = pinnedThreads.has(b.id) ? 0 : 1;
                          return ap - bp;
                        });
                        return (
                          <div key={subKey} className={subRevoked ? "opacity-50" : ""}>
                            <button
                              type="button"
                              onClick={() => toggleSubGroup(subKey)}
                              className="w-full flex items-center gap-2 px-4 py-1.5 text-left border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
                            >
                              <svg
                                className={`w-2.5 h-2.5 shrink-0 transition-transform ${subOpen ? "rotate-90" : ""}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2.5}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: subColor.bg }}
                              />
                              <span className={`text-[11px] font-semibold truncate uppercase text-[var(--foreground)] ${subRevoked ? "line-through" : ""}`}>
                                {sub.label}
                              </span>
                              {subRevoked && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-900/60 text-red-300 font-medium shrink-0">
                                  Disconnected
                                </span>
                              )}
                              <span className="ml-auto text-[10px] text-[var(--muted-foreground)] shrink-0">
                                {sub.threads.length}
                              </span>
                            </button>
                            {subOpen && subSorted.map((thread) => {
                              const isActive = thread.id === activeThreadId;
                              const isPinned = pinnedThreads.has(thread.id);
                              return (
                                <div key={thread.id} className="relative group">
                                  <Link
                                    href={`/threads/${thread.id}`}
                                    className={`block pl-6 pr-3 py-2 border-b border-[var(--border)] transition-colors ${
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
                                      <h3 className={`text-sm leading-tight flex-1 ${isActive ? "font-semibold" : "font-medium"}`}>
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
                                        <FormattedDate date={thread.last_message_at ?? thread.created_at} />
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
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(thread.id); }}
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
                                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); archiveThread(thread.id); }}
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
                        );
                      })
                    ) : (
                    visibleThreads.map((thread) => {
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
                              {(!isAccordion || groupBy === "group") && thread.agent_name && (() => {
                                const agentColor = getAgentColor(thread.agent_name, agentColorOverrides);
                                return (
                                  <span
                                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                    style={{ backgroundColor: agentColor.bg, color: agentColor.fg }}
                                  >
                                    {thread.agent_name}
                                  </span>
                                );
                              })()}
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
                    })
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

      {showManageGroups && (
        <ManageGroupsModal
          groups={agentGroups}
          agentKeys={agentKeys}
          onClose={() => setShowManageGroups(false)}
          onSave={(saved) => {
            setAgentGroups(saved);
            setShowManageGroups(false);
          }}
        />
      )}

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
      {/* Mobile: portal thread list into hamburger drawer */}
      {portalTarget &&
        createPortal(
          <div className="flex-1 flex flex-col overflow-hidden">
            {sidebarContent}
          </div>,
          portalTarget,
        )}

      {/* Desktop sidebar (skip rendering content when portal is active to avoid shared ref conflicts) */}
      <ResizableSidebar>
        {!portalTarget && sidebarContent}
      </ResizableSidebar>
    </>
  );
}
