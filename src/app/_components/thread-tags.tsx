"use client";

import { useState } from "react";

interface ThreadTagsProps {
  threadId: string;
  initialTags: string[];
}

export function ThreadTags({ threadId, initialTags }: ThreadTagsProps) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/threads/${threadId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_tags" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Request failed" }));
        setError(data.error ?? "Request failed");
      }
    } finally {
      setGenerating(false);
    }
  }

  async function removeTag(tag: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/threads/${threadId}/tags/${encodeURIComponent(tag)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTags((prev) => prev.filter((t) => t !== tag));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)]"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            disabled={loading}
            className="hover:text-red-600 dark:hover:text-red-400"
          >
            &times;
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={requestGenerate}
        disabled={generating}
        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] transition-colors disabled:opacity-50"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v3m6.36-.64l-2.12 2.12M21 12h-3M18.36 18.36l-2.12-2.12M12 21v-3M7.76 18.36l-2.12-2.12M3 12h3M5.64 5.64l2.12 2.12" />
        </svg>
        {generating ? "Requesting..." : tags.length > 0 ? "Regenerate Tags" : "Generate Tags"}
      </button>
      {error && <p className="text-xs text-[var(--destructive)] mt-1">{error}</p>}
    </div>
  );
}
