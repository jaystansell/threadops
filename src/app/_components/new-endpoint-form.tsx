"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ALWAYS_ON_EVENTS } from "@/core/types/webhook-endpoint";

function isAlwaysOn(event: string): boolean {
  return (ALWAYS_ON_EVENTS as readonly string[]).includes(event);
}

export function NewEndpointForm({
  eventTypes,
}: {
  eventTypes: readonly string[];
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const toggleEvent = (event: string) => {
    if (isAlwaysOn(event)) return;
    setSelectedEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/webhook-endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, events: selectedEvents }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to create endpoint");
      }

      setUrl("");
      setSelectedEvents([]);
      setExpanded(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        data-testid="new-endpoint-button"
        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
      >
        + New Endpoint
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="new-endpoint-form"
      className="rounded-lg border border-[var(--border)] p-4 space-y-4"
    >
      <h3 className="text-sm font-semibold">New Webhook Endpoint</h3>

      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="endpoint-url">
          URL
        </label>
        <input
          id="endpoint-url"
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/webhooks"
          data-testid="endpoint-url-input"
          className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Events</label>
        <div className="flex flex-wrap gap-2">
          {eventTypes.map((event) => {
            const alwaysOn = isAlwaysOn(event);
            return (
              <label
                key={event}
                className={`flex items-center gap-1.5 text-sm ${alwaysOn ? "opacity-70" : "cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  checked={alwaysOn || selectedEvents.includes(event)}
                  onChange={() => toggleEvent(event)}
                  disabled={alwaysOn}
                  className="rounded"
                />
                {event}
                {alwaysOn && (
                  <span className="text-xs text-[var(--muted-foreground)]">(always on)</span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || selectedEvents.length === 0}
          data-testid="endpoint-submit"
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create Endpoint"}
        </button>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
        >
          Cancel
        </button>
      </div>

      <p className="text-xs text-[var(--muted-foreground)]">
        A signing secret will be auto-generated and displayed after creation.
      </p>
    </form>
  );
}
