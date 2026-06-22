"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WebhookEndpoint } from "@/core/types";

export function EndpointList({
  initialEndpoints,
}: {
  initialEndpoints: WebhookEndpoint[];
}) {
  const router = useRouter();
  const [endpoints, setEndpoints] =
    useState<WebhookEndpoint[]>(initialEndpoints);
  const [busy, setBusy] = useState<string | null>(null);

  const toggleActive = async (endpoint: WebhookEndpoint) => {
    setBusy(endpoint.id);
    try {
      const res = await fetch(`/api/webhook-endpoints/${endpoint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !endpoint.active }),
      });
      if (res.ok) {
        const updated = await res.json();
        setEndpoints((prev) =>
          prev.map((ep) => (ep.id === updated.id ? updated : ep)),
        );
      }
    } finally {
      setBusy(null);
    }
  };

  const deleteEndpoint = async (endpoint: WebhookEndpoint) => {
    if (!confirm("Delete this webhook endpoint?")) return;
    setBusy(endpoint.id);
    try {
      const res = await fetch(`/api/webhook-endpoints/${endpoint.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setEndpoints((prev) => prev.filter((ep) => ep.id !== endpoint.id));
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  };

  if (endpoints.length === 0) {
    return (
      <p className="text-[var(--muted-foreground)] text-sm">
        No webhook endpoints configured yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2" data-testid="endpoint-list">
      {endpoints.map((ep) => (
        <li
          key={ep.id}
          className="rounded-lg border border-[var(--border)] p-4 space-y-2"
          data-testid="endpoint-item"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm truncate max-w-[300px]">
              {ep.url}
            </span>
            <div className="flex items-center gap-2">
              {ep.filters?.author_kind && (
                <span
                  data-testid="endpoint-filter-badge"
                  className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                >
                  {ep.filters.author_kind === "user" ? "Humans only" : "Agents only"}
                </span>
              )}
              <span
                data-testid="endpoint-status"
                className={`text-xs px-2 py-0.5 rounded-full ${
                  ep.active
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                }`}
              >
                {ep.active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {ep.events.map((event) => (
              <span
                key={event}
                className={`text-xs px-2 py-0.5 rounded-full ${
                  event === "docs.updated"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                }`}
              >
                {event}{event === "docs.updated" ? " (always on)" : ""}
              </span>
            ))}
          </div>

          <div className="text-xs text-[var(--muted-foreground)]">
            Secret: <code className="font-mono">{ep.secret}</code>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => toggleActive(ep)}
              disabled={busy === ep.id}
              data-testid="endpoint-toggle"
              className="px-2 py-1 text-xs rounded border border-[var(--border)] hover:border-[var(--primary)] transition-colors disabled:opacity-50"
            >
              {ep.active ? "Deactivate" : "Activate"}
            </button>
            <button
              onClick={() => deleteEndpoint(ep)}
              disabled={busy === ep.id}
              data-testid="endpoint-delete"
              className="px-2 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
