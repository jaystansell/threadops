"use client";

import { useState, useCallback } from "react";

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
}

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

export function ThreadSummaryEditor({ threadId, initialSummary }: ThreadSummaryEditorProps) {
  const [summary] = useState(initialSummary);
  const [generating, setGenerating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<SummaryLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function requestGenerate() {
    setGenerating(true);
    try {
      await fetch(`/api/threads/${threadId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_summary" }),
      });
    } finally {
      setGenerating(false);
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
    return (
      <button
        type="button"
        onClick={requestGenerate}
        disabled={generating}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] transition-colors disabled:opacity-50"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v3m6.36-.64l-2.12 2.12M21 12h-3M18.36 18.36l-2.12-2.12M12 21v-3M7.76 18.36l-2.12-2.12M3 12h3M5.64 5.64l2.12 2.12" />
        </svg>
        {generating ? "Requesting..." : "Generate Summary"}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="bg-[var(--muted)] rounded-lg px-3 py-2">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-[var(--muted-foreground)]">Summary</p>
          <button
            type="button"
            onClick={requestGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] transition-colors disabled:opacity-50"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v3m6.36-.64l-2.12 2.12M21 12h-3M18.36 18.36l-2.12-2.12M12 21v-3M7.76 18.36l-2.12-2.12M3 12h3M5.64 5.64l2.12 2.12" />
            </svg>
            {generating ? "Requesting..." : "Regenerate"}
          </button>
        </div>
        <p className="text-sm">{summary}</p>
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
