"use client";

import { useState, useCallback } from "react";
import type { Message } from "@/core/types";
import { ThreadTimeline, loadSortOrder, saveSortOrder } from "./thread-timeline";
import type { ThreadEvent } from "./thread-timeline";
import { MessageComposer } from "./message-composer";
import type { SortOrder } from "./thread-timeline";

interface ThreadDetailClientProps {
  messages: Message[];
  threadId: string;
  userId: string;
  isOpen: boolean;
  isAgentRevoked?: boolean;
  agentName?: string | null;
  agentApiKeyId?: string | null;
  threadEvents?: ThreadEvent[];
  attachmentCounts?: Record<string, number>;
}

export function ThreadDetailClient({
  messages,
  threadId,
  userId,
  isOpen,
  isAgentRevoked = false,
  agentName = null,
  agentApiKeyId = null,
  threadEvents = [],
  attachmentCounts = {},
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
    <div>
      {isAgentRevoked && (
        <p className="text-[11px] text-amber-400 mb-1.5 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          Replies won&apos;t reach the disconnected agent, but you can still post for the record.
        </p>
      )}
      <MessageComposer threadId={threadId} userId={userId} agentApiKeyId={agentApiKeyId} />
    </div>
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
        threadEvents={threadEvents}
        attachmentCounts={attachmentCounts}
        agentName={agentName}
      />

      {sortOrder === "old-first" && composer}
    </div>
  );
}
