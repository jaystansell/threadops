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
  const [summary, setSummary] = useState(initialSummary);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialSummary);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<SummaryLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function saveSummary() {
    setLoading(true);
    try {
      const res = await fetch(`/api/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: draft || null }),
      });
      if (res.ok) {
        setSummary(draft);
        setEditing(false);
        // Reset history so it refetches on next open
        setHistory([]);
      }
    } finally {
      setLoading(false);
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

  if (!summary && !editing) {
    return (
      <button
        type="button"
        onClick={() => { setEditing(true); setDraft(""); }}
        className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
      >
        + Add summary
      </button>
    );
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <label className="text-xs font-medium">Summary</label>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          disabled={loading}
          className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:border-[var(--primary)] resize-none"
          placeholder="Write a summary for this thread..."
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={saveSummary}
            disabled={loading}
            className="text-xs px-3 py-1 rounded bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setDraft(summary); }}
            disabled={loading}
            className="text-xs px-3 py-1 rounded border border-[var(--border)] hover:bg-[var(--muted)]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className="bg-[var(--muted)] rounded-lg px-3 py-2 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => { setEditing(true); setDraft(summary); }}
      >
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-[var(--muted-foreground)]">Summary</p>
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
