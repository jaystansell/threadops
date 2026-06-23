"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import type { Message } from "@/core/types";
import { createAuthBrowserClient } from "@/adapters/supabase/auth/browser";
import { createRealtimeAdapter } from "@/adapters/supabase/realtime";
import type { ThreadId } from "@/core/types";
import { remarkSlackChannels } from "./remark-slack-channels";
import { FormattedDate } from "./formatted-date";
import { MessageAttachments, AttachmentBadge } from "./message-attachments";
import { MessageDetailsPanel } from "./message-details-panel";
import { AwaitingResponseIndicator } from "./awaiting-response-indicator";
import { UnresponsiveAgentHint } from "./unresponsive-agent-hint";
import { AgentProcessingStatus } from "./agent-processing-status";
import { buildDiagnosticPrompt } from "./thread-debug-panel";
import {
  ExternalLinkModal,
  isInternalUrl,
  getTrustedDomains,
  extractDomain,
} from "./external-link-modal";
import { SourceIcon, resolveSourceType } from "./source-icon";

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function deliveryMethod(authorKind: string): string {
  return authorKind === "agent" ? "API" : "browser";
}

export interface ThreadEvent {
  id: string;
  event_type: string;
  actor_kind: string;
  actor_label: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

type TimelineItem =
  | { kind: "message"; data: Message; created_at: string }
  | { kind: "event"; data: ThreadEvent; created_at: string };

function eventDescription(evt: ThreadEvent): string {
  const actor = evt.actor_label ?? evt.actor_kind;
  if (evt.event_type === "auto_reopened") {
    return `Thread reopened automatically. ${actor} posted a message to this archived thread.`;
  }
  if (evt.event_type === "status_changed") {
    const action = evt.new_value === "archived" ? "archived" : "reopened";
    return `Thread ${action} by ${actor}.`;
  }
  return `Thread event: ${evt.event_type}`;
}

export type SortOrder = "old-first" | "new-first";

const SORT_STORAGE_KEY = "threadops-sort-order";

export function loadSortOrder(): SortOrder {
  if (typeof window === "undefined") return "old-first";
  try {
    const stored = localStorage.getItem(SORT_STORAGE_KEY);
    return stored === "new-first" ? "new-first" : "old-first";
  } catch {
    return "old-first";
  }
}

export function saveSortOrder(order: SortOrder) {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, order);
  } catch {
    // Silently handle
  }
}

interface ThreadTimelineProps {
  initialMessages: Message[];
  threadId: string;
  sortOrder: SortOrder;
  threadEvents?: ThreadEvent[];
  attachmentCounts?: Record<string, number>;
  agentName?: string | null;
}

export function ThreadTimeline({
  initialMessages,
  threadId,
  sortOrder,
  threadEvents = [],
  attachmentCounts = {},
  agentName = null,
}: ThreadTimelineProps) {
  const [realtimeMessages, setRealtimeMessages] = useState<Message[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [externalLinkHref, setExternalLinkHref] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const db = createAuthBrowserClient();
    const realtime = createRealtimeAdapter(db);
    const sub = realtime.subscribeToThread(
      threadId as ThreadId,
      (newMessage) => {
        setRealtimeMessages((prev) => {
          if (prev.some((m) => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
      },
    );
    return () => sub.unsubscribe();
  }, [threadId]);

  // Close mobile menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleDelete = useCallback(
    async (messageId: string) => {
      if (
        !window.confirm(
          "Are you sure you want to delete this message? This cannot be undone.",
        )
      ) {
        return;
      }

      setDeletedIds((prev) => new Set(prev).add(messageId));
      setMenuOpenId(null);

      try {
        const res = await fetch(
          `/api/threads/${threadId}/messages/${messageId}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          setDeletedIds((prev) => {
            const next = new Set(prev);
            next.delete(messageId);
            return next;
          });
          alert("Failed to delete message. Please try again.");
        }
      } catch {
        setDeletedIds((prev) => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
        alert("Failed to delete message. Please try again.");
      }
    },
    [threadId],
  );

  const allIds = new Set(initialMessages.map((m) => m.id));
  const extras = realtimeMessages.filter((m) => !allIds.has(m.id));
  const combined = [...initialMessages, ...extras].filter(
    (m) => !deletedIds.has(m.id),
  );

  // Build unified timeline items
  const messageItems: TimelineItem[] = combined.map((m) => ({
    kind: "message" as const,
    data: m,
    created_at: m.created_at,
  }));
  const eventItems: TimelineItem[] = threadEvents.map((e) => ({
    kind: "event" as const,
    data: e,
    created_at: e.created_at,
  }));
  const allItems = [...messageItems, ...eventItems];

  const timeline =
    sortOrder === "new-first"
      ? allItems.sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime(),
        )
      : allItems.sort(
          (a, b) =>
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime(),
        );

  // Build the awaiting-response block (shows when last message is from user)
  const awaitingBlock = (() => {
    const msgs = combined;
    if (msgs.length === 0) return null;
    const lastMsg = msgs.reduce((a, b) =>
      new Date(a.created_at).getTime() > new Date(b.created_at).getTime() ? a : b,
    );
    if (lastMsg.author_kind !== "user") return null;

    const lastAgentMsg = msgs
      .filter((m) => m.author_kind === "agent")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://threadops-jade.vercel.app";
    const diagPrompt = buildDiagnosticPrompt({
      threadId,
      agentName,
      threadTitle: "",
      messageCount: msgs.length,
      lastMessageAt: lastMsg.created_at,
      isAgentRevoked: false,
      baseUrl,
    });

    return (
      <>
        <AgentProcessingStatus threadId={threadId} isAwaiting={true} />
        <AwaitingResponseIndicator agentName={agentName} />
        <UnresponsiveAgentHint
          lastUserMessageAt={lastMsg.created_at}
          lastAgentMessageAt={lastAgentMsg?.created_at ?? null}
          agentName={agentName}
          diagnosticPrompt={diagPrompt}
          threadId={threadId}
        />
      </>
    );
  })();

  if (timeline.length === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">
        No messages yet. Be the first to post.
      </p>
    );
  }

  const newestMsgId = [...combined].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0]?.id;

  return (
    <div className="space-y-3" data-testid="thread-timeline">
      {sortOrder === "new-first" && awaitingBlock}
      {timeline.map((item) => {
        if (item.kind === "event") {
          const evt = item.data;
          const isArchive = evt.new_value === "archived";
          return (
            <div
              key={`event-${evt.id}`}
              className="flex items-center gap-3 px-3 py-2"
            >
              <div className="flex-1 h-px bg-[var(--border)]" />
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {isArchive ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  )}
                </svg>
                <span>{eventDescription(evt)}</span>
                <span className="text-[10px]">
                  <FormattedDate date={evt.created_at} includeTime />
                </span>
              </div>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>
          );
        }

        const msg = item.data;
        return (
          <div
            key={msg.id}
            className="group relative rounded-lg border border-[var(--border)] p-3"
            style={
              msg.id === newestMsgId
                ? { animation: "border-shimmer 3s ease-in-out infinite" }
                : undefined
            }
            data-testid="timeline-message"
          >
            {/* Desktop: trash icon on hover */}
            <button
              type="button"
              onClick={() => handleDelete(msg.id)}
              className="absolute top-2 right-2 hidden group-hover:md:flex items-center justify-center w-6 h-6 rounded text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
              aria-label="Delete message"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
              </svg>
            </button>

            {/* Mobile: ellipsis menu */}
            <div className="absolute top-2 right-2 md:hidden">
              <button
                type="button"
                onClick={() =>
                  setMenuOpenId(menuOpenId === msg.id ? null : msg.id)
                }
                className="flex items-center justify-center w-6 h-6 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                aria-label="Message options"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <circle cx="12" cy="5" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>
              {menuOpenId === msg.id && (
                <div
                  ref={menuRef}
                  className="absolute right-0 top-7 z-20 bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg py-1 min-w-[120px]"
                >
                  <button
                    type="button"
                    onClick={() => handleDelete(msg.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--muted)] transition-colors text-left text-red-500"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                    Delete
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mb-1">
              {msg.author_kind === "agent" ? (
                <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-[var(--primary)] text-[var(--primary-foreground)]">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <circle cx="12" cy="5" r="4" />
                    <circle cx="9" cy="16" r="1" fill="currentColor" />
                    <circle cx="15" cy="16" r="1" fill="currentColor" />
                  </svg>
                  {msg.author_name ?? "agent"}
                </span>
              ) : (
                <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">
                  {msg.author_name ?? "user"}
                </span>
              )}
              <span className="text-xs text-[var(--muted-foreground)]">
                <FormattedDate date={msg.created_at} includeTime />
              </span>
              <AttachmentBadge count={attachmentCounts[msg.id] ?? 0} />
            </div>
            <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
              <Markdown
                remarkPlugins={[remarkGfm, remarkBreaks, remarkSlackChannels]}
                components={{
                  a: ({ children, href, ...props }) => {
                    if (href?.startsWith("slack-channel:")) {
                      const channel = href.replace("slack-channel:", "");
                      return (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)] text-xs font-medium align-middle"
                          title={`Slack channel: #${channel}`}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                            className="shrink-0"
                          >
                            <path d="M6 15a2 2 0 0 1-2 2a2 2 0 0 1-2-2a2 2 0 0 1 2-2h2v2zm1 0a2 2 0 0 1 2-2a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2a2 2 0 0 1-2-2v-5z" fill="currentColor" />
                            <path d="M9 6a2 2 0 0 1-2-2a2 2 0 0 1 2-2a2 2 0 0 1 2 2v2H9zm0 1a2 2 0 0 1 2 2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2a2 2 0 0 1 2-2h5z" fill="currentColor" />
                            <path d="M18 9a2 2 0 0 1 2-2a2 2 0 0 1 2 2a2 2 0 0 1-2 2h-2V9zm-1 0a2 2 0 0 1-2 2a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2a2 2 0 0 1 2 2v5z" fill="currentColor" />
                            <path d="M15 18a2 2 0 0 1 2 2a2 2 0 0 1-2 2a2 2 0 0 1-2-2v-2h2zm0-1a2 2 0 0 1-2-2a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2a2 2 0 0 1-2 2h-5z" fill="currentColor" />
                          </svg>
                          {children}
                        </span>
                      );
                    }
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        {...props}
                        onClick={(e) => {
                          if (
                            href &&
                            !isInternalUrl(href) &&
                            !getTrustedDomains().has(extractDomain(href))
                          ) {
                            e.preventDefault();
                            setExternalLinkHref(href);
                          }
                        }}
                      >
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {msg.body}
              </Markdown>
            </div>
            {(attachmentCounts[msg.id] ?? 0) > 0 && (
              <MessageAttachments
                threadId={threadId}
                messageId={msg.id}
                attachmentCount={attachmentCounts[msg.id] ?? 0}
              />
            )}
            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-[var(--muted-foreground)]">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-green-500"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <SourceIcon sourceType={resolveSourceType(msg.author_kind, msg.metadata)} size={12} />
              <span>
                Delivered via {deliveryMethod(msg.author_kind)} &middot; {relativeTime(msg.created_at)}
              </span>
            </div>
            {msg.metadata && (
              <MessageDetailsPanel
                metadata={msg.metadata}
                messageId={msg.id}
                messageCreatedAt={msg.created_at}
              />
            )}
          </div>
        );
      })}
      {sortOrder !== "new-first" && awaitingBlock}
      {externalLinkHref && (
        <ExternalLinkModal
          href={externalLinkHref}
          onClose={() => setExternalLinkHref(null)}
        />
      )}
    </div>
  );
}
