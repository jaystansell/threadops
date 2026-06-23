"use client";

import { useState, useEffect } from "react";

interface DeliveryRecord {
  id: string;
  status: "pending" | "processing" | "succeeded" | "failed";
  event_type: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  processed_at: string | null;
}

interface WebhookDeliveryStatusProps {
  threadId: string;
  messageId: string;
  authorKind: string;
}

function StatusBadge({ status }: { status: DeliveryRecord["status"] }) {
  const styles: Record<string, string> = {
    succeeded: "text-green-400",
    failed: "text-red-400",
    pending: "text-yellow-400",
    processing: "text-blue-400",
  };

  const labels: Record<string, string> = {
    succeeded: "200 OK",
    failed: "Failed",
    pending: "Pending",
    processing: "Processing",
  };

  return (
    <span className={`font-semibold ${styles[status] ?? "text-[var(--muted-foreground)]"}`}>
      {labels[status] ?? status}
    </span>
  );
}

export function WebhookDeliveryStatus({
  threadId,
  messageId,
  authorKind,
}: WebhookDeliveryStatusProps) {
  const [deliveries, setDeliveries] = useState<DeliveryRecord[] | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

  const isUserMessage = authorKind === "user";

  // Auto-fetch on mount so we can show inline status without requiring click
  useEffect(() => {
    if (!isUserMessage) return;
    const timer = setTimeout(() => {
      fetch(`/api/threads/${threadId}/messages/${messageId}/deliveries`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setDeliveries(data.deliveries);
        })
        .catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [threadId, messageId, isUserMessage]);

  // Only show for user messages (those trigger outbound webhooks to agents)
  if (!isUserMessage) return null;

  const fetchDeliveries = async () => {
    if (deliveries !== null) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/threads/${threadId}/messages/${messageId}/deliveries`,
      );
      if (res.ok) {
        const data = await res.json();
        setDeliveries(data.deliveries);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      fetchDeliveries();
    }
  };

  const handleRetry = async (deliveryId: string) => {
    setRetrying(deliveryId);
    try {
      const res = await fetch(
        `/api/webhook-deliveries/${deliveryId}/retry`,
        { method: "POST" },
      );
      if (res.ok) {
        // Refresh deliveries to show updated status
        const refreshRes = await fetch(
          `/api/threads/${threadId}/messages/${messageId}/deliveries`,
        );
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setDeliveries(data.deliveries);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setRetrying(null);
    }
  };

  // No deliveries yet or still loading initial
  if (deliveries === null || deliveries.length === 0) return null;

  const allSucceeded = deliveries.every((d) => d.status === "succeeded");
  const anyFailed = deliveries.some((d) => d.status === "failed");

  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)]/60 hover:text-[var(--muted-foreground)] transition-colors"
        >
          <svg
            width="8"
            height="8"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={`transition-transform ${open ? "rotate-90" : ""}`}
          >
            <path d="M8 5l8 7-8 7z" />
          </svg>
          <span>
            Webhook:{" "}
            {allSucceeded && (
              <span className="text-green-400 font-medium">
                {deliveries.length === 1 ? "200 OK" : `${deliveries.length}× 200 OK`}
              </span>
            )}
            {anyFailed && !allSucceeded && (
              <span className="text-red-400 font-medium">delivery failed</span>
            )}
            {!allSucceeded && !anyFailed && (
              <span className="text-yellow-400 font-medium">pending</span>
            )}
          </span>
        </button>
        {anyFailed && !allSucceeded && (
          <button
            type="button"
            onClick={() => {
              const failed = deliveries.find((d) => d.status === "failed");
              if (failed) handleRetry(failed.id);
            }}
            disabled={retrying !== null}
            className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 hover:text-red-200 transition-colors disabled:opacity-50"
          >
            {retrying ? "Retrying..." : "Retry"}
          </button>
        )}
      </div>
      {open && (
        <div className="mt-1 border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-[var(--background)] font-mono text-[11px] leading-relaxed space-y-2">
            {loading && <div className="text-[var(--muted-foreground)]">Loading...</div>}
            {deliveries.map((d) => (
              <div key={d.id} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <StatusBadge status={d.status} />
                  <span className="text-[var(--muted-foreground)]">
                    {d.event_type}
                  </span>
                  {d.attempts > 1 && (
                    <span className="text-[var(--muted-foreground)]">
                      ({d.attempts} attempts)
                    </span>
                  )}
                  {d.status === "failed" && (
                    <button
                      type="button"
                      onClick={() => handleRetry(d.id)}
                      disabled={retrying === d.id}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 hover:text-red-200 transition-colors disabled:opacity-50"
                    >
                      {retrying === d.id ? "Retrying..." : "Retry"}
                    </button>
                  )}
                </div>
                {d.last_error && (
                  <div className="text-red-400/80 text-[10px] pl-2">
                    {d.last_error}
                  </div>
                )}
                {d.processed_at && (
                  <div className="text-[var(--muted-foreground)]/60 text-[10px] pl-2">
                    Delivered {new Date(d.processed_at).toLocaleTimeString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
