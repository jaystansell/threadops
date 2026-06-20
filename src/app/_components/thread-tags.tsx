"use client";

import { useState } from "react";

interface ThreadTagsProps {
  threadId: string;
  initialTags: string[];
}

export function ThreadTags({ threadId, initialTags }: ThreadTagsProps) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function addTag(e: React.FormEvent) {
    e.preventDefault();
    const tag = input.trim().toLowerCase();
    if (!tag || tags.includes(tag)) {
      setInput("");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/threads/${threadId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: [tag] }),
      });
      if (res.ok) {
        setTags((prev) => [...prev, tag]);
        setInput("");
      }
    } finally {
      setLoading(false);
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
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
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
      <form onSubmit={addTag} className="inline-flex">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add tag..."
          disabled={loading}
          className="text-xs px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--background)] w-24 focus:outline-none focus:border-[var(--primary)]"
        />
      </form>
    </div>
  );
}
