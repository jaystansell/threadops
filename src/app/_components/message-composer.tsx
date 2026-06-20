"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface MessageComposerProps {
  threadId: string;
  userId: string;
}

const MORE_CONTEXT_MESSAGE =
  "Please expand on this thread with more detail and context. Include relevant background, current status, key decisions or blockers, and any next steps.";

export function MessageComposer({ threadId, userId }: MessageComposerProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [requestingContext, setRequestingContext] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage(messageBody: string) {
    const res = await fetch(`/api/threads/${threadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: messageBody, author_id: userId }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to send message");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;

    setSending(true);
    setError(null);

    try {
      await sendMessage(body.trim());
      setBody("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  async function handleRequestContext() {
    setRequestingContext(true);
    setError(null);

    try {
      await sendMessage(MORE_CONTEXT_MESSAGE);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRequestingContext(false);
    }
  }

  const isBusy = sending || requestingContext;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-2" data-testid="message-composer">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
        placeholder="Type your message... (⌘/Ctrl+Enter to send)"
        rows={3}
        data-testid="message-input"
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--primary)] resize-none"
        disabled={isBusy}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isBusy || !body.trim()}
          data-testid="message-send"
          className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {sending ? "Sending..." : "Send Message"}
        </button>
        <button
          type="button"
          onClick={handleRequestContext}
          disabled={isBusy}
          data-testid="request-context"
          className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-50 transition-colors"
        >
          {requestingContext ? "Requesting..." : "Ask for More Context"}
        </button>
      </div>
    </form>
  );
}
