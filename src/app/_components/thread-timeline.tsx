"use client";

import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import type { Message } from "@/core/types";
import { createAuthBrowserClient } from "@/adapters/supabase/auth/browser";
import { createRealtimeAdapter } from "@/adapters/supabase/realtime";
import type { ThreadId } from "@/core/types";
import { FormattedDate } from "./formatted-date";

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
}

export function ThreadTimeline({
  initialMessages,
  threadId,
  sortOrder,
}: ThreadTimelineProps) {
  const [realtimeMessages, setRealtimeMessages] = useState<Message[]>([]);

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

  const allIds = new Set(initialMessages.map((m) => m.id));
  const extras = realtimeMessages.filter((m) => !allIds.has(m.id));
  const combined = [...initialMessages, ...extras];

  const messages =
    sortOrder === "new-first"
      ? [...combined].sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime(),
        )
      : combined;

  if (messages.length === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">
        No messages yet. Be the first to post.
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="thread-timeline">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className="rounded-lg border border-[var(--border)] p-3"
          data-testid="timeline-message"
        >
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
          </div>
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
            <Markdown remarkPlugins={[remarkGfm, remarkBreaks]}>{msg.body}</Markdown>
          </div>
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
            <span>
              Delivered via {deliveryMethod(msg.author_kind)} &middot; {relativeTime(msg.created_at)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
