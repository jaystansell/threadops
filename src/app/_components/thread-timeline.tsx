"use client";

import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import type { Message } from "@/core/types";
import { createAuthBrowserClient } from "@/adapters/supabase/auth/browser";
import { createRealtimeAdapter } from "@/adapters/supabase/realtime";
import type { ThreadId } from "@/core/types";
import { FormattedDate } from "./formatted-date";

interface ThreadTimelineProps {
  initialMessages: Message[];
  threadId: string;
}

export function ThreadTimeline({
  initialMessages,
  threadId,
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
  const messages = [...initialMessages, ...extras];

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
            <Markdown>{msg.body}</Markdown>
          </div>
        </div>
      ))}
    </div>
  );
}
