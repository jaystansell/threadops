"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface MessageComposerProps {
  threadId: string;
  userId: string;
}

export function MessageComposer({ threadId, userId }: MessageComposerProps) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), author_id: userId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send message");
      }

      setBody("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2" data-testid="message-composer">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Type your message..."
        rows={3}
        data-testid="message-input"
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--primary)] resize-none"
        disabled={sending}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={sending || !body.trim()}
        data-testid="message-send"
        className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {sending ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
}
