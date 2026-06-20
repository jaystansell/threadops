"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
interface NewThreadFormProps {
  companyId: string;
}

export function NewThreadForm({ companyId }: NewThreadFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !messageBody.trim()) return;

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
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create thread");
      }

      const thread = await res.json();
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

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || !title.trim() || !messageBody.trim()}
          data-testid="thread-submit"
          className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
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
