"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ThreadStatus } from "@/core/types";
import { ThreadTags } from "./thread-tags";
import { ThreadSummaryEditor } from "./thread-summary-editor";
import { StickmanArchiveAnimation } from "./stickman-animations";

interface ThreadActionsPanelProps {
  threadId: string;
  companyId: string;
  currentStatus: ThreadStatus;
  initialTags: string[];
  initialSummary: string;
}

export function ThreadActionsPanel({
  threadId,
  companyId,
  currentStatus,
  initialTags,
  initialSummary,
}: ThreadActionsPanelProps) {
  const router = useRouter();

  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [tagsGenerating, setTagsGenerating] = useState(false);
  const [tagsRequested, setTagsRequested] = useState(false);
  const [tagsTrigger, setTagsTrigger] = useState(0);
  const [tagsError, setTagsError] = useState<string | null>(null);

  const [summaryGenerating, setSummaryGenerating] = useState(false);
  const [summaryRequested, setSummaryRequested] = useState(false);
  const [summaryTrigger, setSummaryTrigger] = useState(0);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [showArchiveAnimation, setShowArchiveAnimation] = useState(false);
  const archiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (archiveTimerRef.current) clearTimeout(archiveTimerRef.current);
    };
  }, []);

  const isArchived = currentStatus === "archived";

  async function handleStatusChange() {
    const newStatus: ThreadStatus = isArchived ? "open" : "archived";
    setStatusUpdating(true);
    setStatusError(null);
    try {
      const res = await fetch(`/api/threads/${threadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, company_id: companyId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }
      if (newStatus === "archived") {
        setShowArchiveAnimation(true);
        archiveTimerRef.current = setTimeout(() => {
          archiveTimerRef.current = null;
          window.dispatchEvent(
            new CustomEvent("threadops:thread-archived", { detail: { threadId } }),
          );
          router.push("/threads");
        }, 700);
      } else {
        setStatusUpdating(false);
        router.refresh();
      }
    } catch (err) {
      setStatusUpdating(false);
      setStatusError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleGenerateTags() {
    setTagsGenerating(true);
    setTagsError(null);
    try {
      const res = await fetch(`/api/threads/${threadId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_tags" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Request failed" }));
        setTagsError(data.error ?? "Request failed");
        setTagsGenerating(false);
        return;
      }
      setTagsGenerating(false);
      setTagsRequested(true);
      setTagsTrigger((c) => c + 1);
    } catch {
      setTagsGenerating(false);
      setTagsError("Request failed");
    }
  }

  async function handleGenerateSummary() {
    setSummaryGenerating(true);
    setSummaryError(null);
    try {
      const res = await fetch(`/api/threads/${threadId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_summary" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Request failed" }));
        setSummaryError(data.error ?? "Request failed");
        setSummaryGenerating(false);
        return;
      }
      setSummaryGenerating(false);
      setSummaryRequested(true);
      setSummaryTrigger((c) => c + 1);
    } catch {
      setSummaryGenerating(false);
      setSummaryError("Request failed");
    }
  }

  const btnBase = "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50";

  return (
    <>
      <ThreadTags
        threadId={threadId}
        initialTags={initialTags}
        hideButton
        generateTrigger={tagsTrigger}
        onPollComplete={() => setTagsRequested(false)}
      />

      <div className="mt-3 flex items-center gap-2 flex-wrap" data-testid="thread-actions-bar">
        {/* Archive / Reopen */}
        <button
          type="button"
          onClick={handleStatusChange}
          disabled={statusUpdating}
          data-testid={`status-action-${isArchived ? "open" : "archived"}`}
          className={`${btnBase} ${
            isArchived
              ? "bg-emerald-600/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/25"
              : "bg-amber-600/15 text-amber-400 border border-amber-500/30 hover:bg-amber-600/25"
          }`}
        >
          {isArchived ? (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          )}
          {statusUpdating ? "..." : isArchived ? "Reopen" : "Archive"}
        </button>
        {showArchiveAnimation && (
          <StickmanArchiveAnimation onComplete={() => setShowArchiveAnimation(false)} />
        )}

        {/* Generate Tags */}
        <button
          type="button"
          onClick={handleGenerateTags}
          disabled={tagsGenerating || tagsRequested}
          className={`${btnBase} border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]`}
        >
          {tagsRequested ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="animate-spin">
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v3m6.36-.64l-2.12 2.12M21 12h-3M18.36 18.36l-2.12-2.12M12 21v-3M7.76 18.36l-2.12-2.12M3 12h3M5.64 5.64l2.12 2.12" />
            </svg>
          )}
          {tagsGenerating ? "Requesting..." : tagsRequested ? "Tags Requested" : "Generate Tags"}
        </button>

        {/* Generate Summary */}
        <button
          type="button"
          onClick={handleGenerateSummary}
          disabled={summaryGenerating || summaryRequested}
          className={`${btnBase} border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]`}
        >
          {summaryRequested ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="animate-spin">
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v3m6.36-.64l-2.12 2.12M21 12h-3M18.36 18.36l-2.12-2.12M12 21v-3M7.76 18.36l-2.12-2.12M3 12h3M5.64 5.64l2.12 2.12" />
            </svg>
          )}
          {summaryGenerating ? "Requesting..." : summaryRequested ? "Summary Requested" : "Generate Summary"}
        </button>

        {statusError && <span className="text-xs text-red-500">{statusError}</span>}
        {tagsError && <span className="text-xs text-[var(--destructive)]">{tagsError}</span>}
        {summaryError && <span className="text-xs text-[var(--destructive)]">{summaryError}</span>}
      </div>

      {initialSummary !== undefined && (
        <div className="mt-6">
          <ThreadSummaryEditor
            threadId={threadId}
            initialSummary={initialSummary}
            hideButton
            generateTrigger={summaryTrigger}
            onPollComplete={() => setSummaryRequested(false)}
          />
        </div>
      )}
    </>
  );
}
