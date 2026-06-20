"use client";

import { useEffect, useState } from "react";
import type { Message } from "@/core/types";
import { createBrowserClient } from "@/adapters/supabase/client";
import { createRealtimeAdapter } from "@/adapters/supabase/realtime";
import type { ThreadId } from "@/core/types";

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
    const db = createBrowserClient();
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
    <div className="space-y-3">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className="rounded-lg border border-[var(--border)] p-3"
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                msg.author_kind === "agent"
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "bg-[var(--muted)] text-[var(--muted-foreground)]"
              }`}
            >
              {msg.author_kind}
            </span>
            <span
              className="text-xs text-[var(--muted-foreground)]"
              suppressHydrationWarning
            >
              {new Date(msg.created_at).toLocaleString()}
            </span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
        </div>
      ))}
    </div>
  );
}
