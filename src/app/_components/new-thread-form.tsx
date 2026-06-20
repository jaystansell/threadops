"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Agent {
  id: string;
  label: string;
}

interface NewThreadFormProps {
  companyId: string;
  agents?: Agent[];
}

export function NewThreadForm({ companyId, agents = [] }: NewThreadFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !messageBody.trim() || !selectedAgent) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          company_id: companyId,
          message_body: messageBody.trim(),
          agent_api_key_id: selectedAgent,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create thread");
      }

      const thread = await res.json();

      // Add tags if any
      if (tags.length > 0) {
        await fetch(`/api/threads/${thread.id}/tags`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags }),
        });
      }

      router.push(`/threads/${thread.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="new-thread-form">
      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium mb-1"
        >
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Thread title"
          required
          data-testid="thread-title-input"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--primary)]"
          disabled={submitting}
        />
      </div>

      <div>
        <label
          htmlFor="agent"
          className="block text-sm font-medium mb-1"
        >
          Agent <span className="text-red-500">*</span>
        </label>
        {agents.length > 0 ? (
          <select
            id="agent"
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            required
            data-testid="thread-agent-select"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--primary)]"
            disabled={submitting}
          >
            <option value="">Select an agent</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.label}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">
            No active agents. Create an API key first.
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="message"
          className="block text-sm font-medium mb-1"
        >
          Message <span className="text-red-500">*</span>
        </label>
        <textarea
          id="message"
          value={messageBody}
          onChange={(e) => setMessageBody(e.target.value)}
          placeholder="Write the first message..."
          rows={5}
          required
          data-testid="thread-message-input"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--primary)] resize-none"
          disabled={submitting}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Tags</label>
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
            >
              {tag}
              <button
                type="button"
                onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                className="hover:text-red-600"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              const tag = tagInput.trim().toLowerCase();
              if (tag && !tags.includes(tag)) {
                setTags((prev) => [...prev, tag]);
              }
              setTagInput("");
            }
          }}
          placeholder="Type a tag and press Enter..."
          disabled={submitting}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--primary)]"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || !title.trim() || !messageBody.trim() || !selectedAgent}
          data-testid="thread-submit"
          className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {submitting ? "Creating..." : "Create Thread"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/threads")}
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
