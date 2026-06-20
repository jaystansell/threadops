"use client";

import { useState } from "react";

interface ThreadSummaryEditorProps {
  threadId: string;
  initialSummary: string;
}

export function ThreadSummaryEditor({ threadId, initialSummary }: ThreadSummaryEditorProps) {
  const [summary, setSummary] = useState(initialSummary);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialSummary);
  const [loading, setLoading] = useState(false);

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
      }
    } finally {
      setLoading(false);
    }
  }

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
    <div
      className="bg-[var(--muted)] rounded-lg px-3 py-2 cursor-pointer hover:opacity-80 transition-opacity"
      onClick={() => { setEditing(true); setDraft(summary); }}
    >
      <p className="text-xs font-medium text-[var(--muted-foreground)] mb-1">Summary</p>
      <p className="text-sm">{summary}</p>
    </div>
  );
}
