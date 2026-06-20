"use client";

import { useState, useCallback } from "react";
import type { Message } from "@/core/types";
import { ThreadTimeline, loadSortOrder, saveSortOrder } from "./thread-timeline";
import { MessageComposer } from "./message-composer";
import type { SortOrder } from "./thread-timeline";

interface ThreadDetailClientProps {
  messages: Message[];
  threadId: string;
  userId: string;
  isOpen: boolean;
}

export function ThreadDetailClient({
  messages,
  threadId,
  userId,
  isOpen,
}: ThreadDetailClientProps) {
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => loadSortOrder());

  const toggleSort = useCallback(() => {
    setSortOrder((prev) => {
      const next: SortOrder = prev === "old-first" ? "new-first" : "old-first";
      saveSortOrder(next);
      return next;
    });
  }, []);

  const composer = isOpen ? (
    <MessageComposer threadId={threadId} userId={userId} />
  ) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={toggleSort}
          className="flex items-center gap-1.5 px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--primary)] transition-colors"
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
            className={sortOrder === "new-first" ? "rotate-180" : ""}
          >
            <path d="M3 8l4-4 4 4" />
            <path d="M7 4v16" />
            <path d="M13 16l4 4 4-4" />
            <path d="M17 20V4" />
          </svg>
          {sortOrder === "old-first" ? "Oldest first" : "Newest first"}
        </button>
      </div>

      {sortOrder === "new-first" && composer}

      <ThreadTimeline
        initialMessages={messages}
        threadId={threadId}
        sortOrder={sortOrder}
      />

      {sortOrder === "old-first" && composer}
    </div>
  );
}
