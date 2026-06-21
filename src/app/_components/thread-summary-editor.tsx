"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface SummaryLogEntry {
  id: string;
  summary: string;
  author_kind: string;
  author_name: string | null;
  created_at: string;
}

interface ThreadSummaryEditorProps {
  threadId: string;
  initialSummary: string;
  hideButton?: boolean;
  generateTrigger?: number;
  onPollComplete?: () => void;
}

const POLL_INTERVAL = 5000;
const MAX_POLLS = 60;

function formatLogDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function ThreadSummaryEditor({ threadId, initialSummary, hideButton, generateTrigger, onPollComplete }: ThreadSummaryEditorProps) {
  const [summary, setSummary] = useState(initialSummary);
  const [generating, setGenerating] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<SummaryLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const prevTriggerRef = useRef(generateTrigger ?? 0);
  const onPollCompleteRef = useRef(onPollComplete);
  useEffect(() => { onPollCompleteRef.current = onPollComplete; }, [onPollComplete]);

  useEffect(() => {
    if (generateTrigger !== undefined && generateTrigger > prevTriggerRef.current) {
      prevTriggerRef.current = generateTrigger;
      setRequested(true);
    }
  }, [generateTrigger]);

  // Poll for summary updates after requesting generation
  useEffect(() => {
    if (!requested) return;

    const baselineSummary = summary;
    pollCountRef.current = 0;

    pollRef.current = setInterval(async () => {
      pollCountRef.current++;
      if (pollCountRef.current > MAX_POLLS) {
        setRequested(false);
        onPollCompleteRef.current?.();
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }
      try {
        const res = await fetch(`/api/threads/${threadId}/summaries`);
        if (res.ok) {
          const data = await res.json();
          const entries = data.summaries ?? [];
          if (entries.length > 0) {
            const latest = entries[0].summary;
            if (latest && latest !== baselineSummary) {
              setSummary(latest);
              setRequested(false);
              onPollCompleteRef.current?.();
              if (pollRef.current) clearInterval(pollRef.current);
            }
          }
        }
      } catch {
        // Silently retry on next interval
      }
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [requested, threadId, summary]);

  async function requestGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/threads/${threadId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_summary" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Request failed" }));
        setError(data.error ?? "Request failed");
        setGenerating(false);
        return;
      }
      setGenerating(false);
      setRequested(true);
    } catch {
      setGenerating(false);
      setError("Request failed");
    }
  }

  const loadHistory = useCallback(async () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/threads/${threadId}/summaries`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.summaries ?? []);
        setShowHistory(true);
      }
    } finally {
      setHistoryLoading(false);
    }
  }, [threadId, showHistory]);

  if (!summary) {
    if (hideButton) return null;
    return (
      <div>
        <button
          type="button"
          onClick={requestGenerate}
          disabled={generating || requested}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] transition-colors disabled:opacity-50"
        >
          {requested ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="animate-spin">
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v3m6.36-.64l-2.12 2.12M21 12h-3M18.36 18.36l-2.12-2.12M12 21v-3M7.76 18.36l-2.12-2.12M3 12h3M5.64 5.64l2.12 2.12" />
            </svg>
          )}
          {generating ? "Requesting..." : requested ? "Summary Requested" : "Generate Summary"}
        </button>
        {error && <p className="text-xs text-[var(--destructive)] mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="bg-[var(--muted)] rounded-lg px-3 py-2">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-[var(--muted-foreground)]">Summary</p>
          {!hideButton && (
            <button
              type="button"
              onClick={requestGenerate}
              disabled={generating || requested}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] transition-colors disabled:opacity-50"
            >
              {requested ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="animate-spin">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v3m6.36-.64l-2.12 2.12M21 12h-3M18.36 18.36l-2.12-2.12M12 21v-3M7.76 18.36l-2.12-2.12M3 12h3M5.64 5.64l2.12 2.12" />
                </svg>
              )}
              {generating ? "Requesting..." : requested ? "Summary Requested" : "Regenerate"}
            </button>
          )}
        </div>
        <p className="text-sm">{summary}</p>
        {error && <p className="text-xs text-[var(--destructive)] mt-1">{error}</p>}
      </div>
      <button
        type="button"
        onClick={loadHistory}
        disabled={historyLoading}
        className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
      >
        {historyLoading ? "Loading..." : showHistory ? "Hide history" : "Show summary history"}
      </button>
      {showHistory && history.length > 0 && (
        <div className="border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="px-3 py-1.5 bg-[var(--muted)] border-b border-[var(--border)]">
            <p className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase tracking-wider">
              Summary log ({history.length} {history.length === 1 ? "entry" : "entries"})
            </p>
          </div>
          <div className="divide-y divide-[var(--border)]/30 max-h-60 overflow-y-auto">
            {history.map((entry) => (
              <div key={entry.id} className="px-3 py-2">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                    {entry.author_kind === "agent" ? "🤖" : "👤"} {entry.author_name ?? entry.author_kind}
                  </span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    {formatLogDate(entry.created_at)}
                  </span>
                </div>
                <p className="text-xs text-[var(--foreground)]">{entry.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {showHistory && history.length === 0 && (
        <p className="text-[10px] text-[var(--muted-foreground)]">No summary history yet.</p>
      )}
    </div>
  );
}
