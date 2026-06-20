"use client";

import { useState } from "react";

interface ThreadMetadataProps {
  threadId: string;
  initialMetadata: Record<string, unknown>;
}

export function ThreadMetadata({ threadId, initialMetadata }: ThreadMetadataProps) {
  const [metadata, setMetadata] = useState<Record<string, unknown>>(initialMetadata);
  const [expanded, setExpanded] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [loading, setLoading] = useState(false);

  const entries = Object.entries(metadata);

  if (entries.length === 0 && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
      >
        + Add metadata
      </button>
    );
  }

  async function saveMetadata(set?: Record<string, unknown>, unset?: string[]) {
    setLoading(true);
    try {
      const res = await fetch(`/api/threads/${threadId}/metadata`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: set, unset }),
      });
      if (res.ok) {
        const data = await res.json();
        setMetadata(data.metadata ?? {});
      }
    } finally {
      setLoading(false);
    }
  }

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!newKey.trim()) return;
    await saveMetadata({ [newKey.trim()]: newValue });
    setNewKey("");
    setNewValue("");
  }

  async function removeEntry(key: string) {
    await saveMetadata(undefined, [key]);
  }

  async function updateEntry(key: string) {
    await saveMetadata({ [key]: editValue });
    setEditingKey(null);
    setEditValue("");
  }

  return (
    <div className="border border-[var(--border)] rounded-lg">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-[var(--muted)] transition-colors rounded-lg"
      >
        <span>Metadata {entries.length > 0 && `(${entries.length})`}</span>
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span className="font-mono font-medium text-[var(--foreground)] min-w-[80px]">{key}</span>
              {editingKey === key ? (
                <form onSubmit={(e) => { e.preventDefault(); updateEntry(key); }} className="flex-1 flex gap-1">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1 px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--background)] text-xs focus:outline-none focus:border-[var(--primary)]"
                    autoFocus
                  />
                  <button type="submit" disabled={loading} className="text-[var(--primary)] hover:underline">Save</button>
                  <button type="button" onClick={() => setEditingKey(null)} className="text-[var(--muted-foreground)] hover:underline">Cancel</button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-[var(--muted-foreground)] truncate font-mono">
                    {typeof value === "string" ? value : JSON.stringify(value)}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setEditingKey(key); setEditValue(typeof value === "string" ? value : JSON.stringify(value)); }}
                    disabled={loading}
                    className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removeEntry(key)}
                    disabled={loading}
                    className="text-[var(--muted-foreground)] hover:text-red-600"
                  >
                    &times;
                  </button>
                </>
              )}
            </div>
          ))}

          <form onSubmit={addEntry} className="flex items-center gap-2">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Key"
              disabled={loading}
              className="w-24 px-2 py-0.5 text-xs rounded border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:border-[var(--primary)]"
            />
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Value"
              disabled={loading}
              className="flex-1 px-2 py-0.5 text-xs rounded border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:border-[var(--primary)]"
            />
            <button
              type="submit"
              disabled={loading || !newKey.trim()}
              className="text-xs px-2 py-0.5 rounded bg-[var(--accent)] text-[var(--accent-foreground)] disabled:opacity-50"
            >
              Add
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
