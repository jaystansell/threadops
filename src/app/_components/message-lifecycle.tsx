"use client";

import { useState, useEffect } from "react";

interface LifecycleDelivery {
  id: string;
  status: "pending" | "processing" | "succeeded" | "failed";
  event_type: string;
  endpoint_url_masked: string | null;
  response_code: number | null;
  latency_ms: number | null;
  created_at: string;
  processed_at: string | null;
  last_error: string | null;
}

interface LifecycleAck {
  status: string;
  created_at: string;
}

interface LifecycleReply {
  message_id: string;
  author_name: string | null;
  created_at: string;
}

interface LifecycleData {
  delivery: LifecycleDelivery | null;
  ack: LifecycleAck | null;
  reply: LifecycleReply | null;
}

type StepStatus = "complete" | "pending" | "failed" | "inactive";

interface MessageLifecycleProps {
  threadId: string;
  messageId: string;
  authorKind: string;
}

function StepDot({ status }: { status: StepStatus }) {
  const colors: Record<StepStatus, string> = {
    complete: "bg-green-500",
    pending: "bg-amber-500 animate-pulse",
    failed: "bg-red-500",
    inactive: "bg-[var(--muted-foreground)]/30",
  };

  return (
    <div
      className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[status]}`}
    />
  );
}

function StepConnector({ status }: { status: StepStatus }) {
  const colors: Record<StepStatus, string> = {
    complete: "bg-green-500/50",
    pending: "bg-amber-500/30",
    failed: "bg-red-500/30",
    inactive: "bg-[var(--muted-foreground)]/15",
  };

  return <div className={`w-4 h-px flex-shrink-0 ${colors[status]}`} />;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function MessageLifecycle({
  threadId,
  messageId,
  authorKind,
}: MessageLifecycleProps) {
  const [data, setData] = useState<LifecycleData | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const isUserMessage = authorKind === "user";

  // Auto-fetch on mount for user messages
  useEffect(() => {
    if (!isUserMessage) return;
    const timer = setTimeout(() => {
      fetch(`/api/threads/${threadId}/messages/${messageId}/lifecycle`)
        .then((res) => (res.ok ? res.json() : null))
        .then((d) => {
          if (d) setData(d);
        })
        .catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [threadId, messageId, isUserMessage]);

  if (!isUserMessage) return null;
  if (!data || !data.delivery) return null;

  const deliveryStatus: StepStatus =
    data.delivery.status === "succeeded"
      ? "complete"
      : data.delivery.status === "failed"
        ? "failed"
        : "pending";

  const ackStatus: StepStatus = data.ack
    ? "complete"
    : deliveryStatus === "failed"
      ? "inactive"
      : "pending";

  const replyStatus: StepStatus = data.reply
    ? "complete"
    : ackStatus === "complete"
      ? "pending"
      : "inactive";

  // Summary line for collapsed state
  const httpBadge =
    data.delivery.response_code && deliveryStatus === "complete"
      ? ` (${data.delivery.response_code})`
      : "";
  const summaryText = (() => {
    if (data.reply) return `Delivered${httpBadge} → ACK'd → Replied`;
    if (data.ack) return `Delivered${httpBadge} → ACK'd → Awaiting reply`;
    if (deliveryStatus === "complete")
      return `Delivered${httpBadge} → Awaiting ACK`;
    if (deliveryStatus === "failed") return "Delivery failed";
    return "Delivering...";
  })();

  const summaryColor = (() => {
    if (deliveryStatus === "failed") return "text-red-400";
    if (data.reply) return "text-green-400";
    return "text-amber-400";
  })();

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => {
          if (!open) setLoading(true);
          setOpen(!open);
          // Refresh data when opening
          if (!open) {
            fetch(
              `/api/threads/${threadId}/messages/${messageId}/lifecycle`,
            )
              .then((res) => (res.ok ? res.json() : null))
              .then((d) => {
                if (d) setData(d);
              })
              .catch(() => {})
              .finally(() => setLoading(false));
          }
        }}
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
          Lifecycle:{" "}
          <span className={`font-medium ${summaryColor}`}>
            {summaryText}
          </span>
        </span>
      </button>

      {open && (
        <div className="mt-1.5 border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="px-3 py-2.5 bg-[var(--background)]">
            {loading && (
              <div className="text-[10px] text-[var(--muted-foreground)]">
                Loading...
              </div>
            )}
            {!loading && (
              <>
                {/* Mini progress bar */}
                <div className="flex items-center gap-0 mb-3">
                  <StepDot status={deliveryStatus} />
                  <StepConnector status={deliveryStatus} />
                  <StepDot status={ackStatus} />
                  <StepConnector status={ackStatus} />
                  <StepDot status={replyStatus} />
                  <span className="ml-2 text-[10px] text-[var(--muted-foreground)]">
                    {data.reply
                      ? "Complete"
                      : deliveryStatus === "failed"
                        ? "Failed"
                        : "In progress"}
                  </span>
                </div>

                {/* Step details */}
                <div className="space-y-2 font-mono text-[11px] leading-relaxed">
                  {/* Step 1: Webhook Delivery */}
                  <div className="flex items-start gap-2">
                    <StepDot status={deliveryStatus} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--foreground)]">
                          Webhook Fired
                        </span>
                        <span className="text-[var(--muted-foreground)]">
                          {formatTime(data.delivery.created_at)}
                        </span>
                      </div>
                      {data.delivery.endpoint_url_masked && (
                        <div className="text-[10px] text-[var(--muted-foreground)] truncate">
                          → {data.delivery.endpoint_url_masked}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        {data.delivery.response_code && (
                          <span
                            className={
                              data.delivery.response_code >= 200 &&
                              data.delivery.response_code < 300
                                ? "text-green-400"
                                : "text-red-400"
                            }
                          >
                            HTTP {data.delivery.response_code}
                          </span>
                        )}
                        {data.delivery.latency_ms !== null && (
                          <span className="text-[var(--muted-foreground)]">
                            {data.delivery.latency_ms}ms
                          </span>
                        )}
                        {deliveryStatus === "failed" &&
                          data.delivery.last_error && (
                            <span className="text-red-400/80 text-[10px] truncate">
                              {data.delivery.last_error}
                            </span>
                          )}
                        {deliveryStatus === "failed" && (
                          <button
                            type="button"
                            disabled={retrying}
                            onClick={async () => {
                              setRetrying(true);
                              try {
                                await fetch(
                                  `/api/webhook-deliveries/${data.delivery!.id}`,
                                  { method: "POST" },
                                );
                                const res = await fetch(
                                  `/api/threads/${threadId}/messages/${messageId}/lifecycle`,
                                );
                                if (res.ok) setData(await res.json());
                              } catch {
                                // ignore
                              } finally {
                                setRetrying(false);
                              }
                            }}
                            className="text-[10px] text-amber-400 hover:text-amber-300 underline"
                          >
                            {retrying ? "Retrying..." : "Retry"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Step 2: ACK */}
                  <div className="flex items-start gap-2">
                    <StepDot status={ackStatus} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold ${ackStatus === "inactive" ? "text-[var(--muted-foreground)]/50" : "text-[var(--foreground)]"}`}
                        >
                          Agent ACK
                        </span>
                        {data.ack && (
                          <span className="text-[var(--muted-foreground)]">
                            {formatTime(data.ack.created_at)}
                          </span>
                        )}
                      </div>
                      {data.ack ? (
                        <div className="text-[10px] text-green-400">
                          Status: {data.ack.status}
                        </div>
                      ) : ackStatus === "pending" ? (
                        <div className="text-[10px] text-amber-400">
                          Waiting for acknowledgement...
                        </div>
                      ) : (
                        <div className="text-[10px] text-[var(--muted-foreground)]/50">
                          Skipped (delivery failed)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 3: Reply */}
                  <div className="flex items-start gap-2">
                    <StepDot status={replyStatus} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold ${replyStatus === "inactive" ? "text-[var(--muted-foreground)]/50" : "text-[var(--foreground)]"}`}
                        >
                          Agent Reply
                        </span>
                        {data.reply && (
                          <span className="text-[var(--muted-foreground)]">
                            {formatTime(data.reply.created_at)}
                          </span>
                        )}
                      </div>
                      {data.reply ? (
                        <div className="text-[10px] text-green-400">
                          Replied by{" "}
                          {data.reply.author_name ?? "agent"}
                        </div>
                      ) : replyStatus === "pending" ? (
                        <div className="text-[10px] text-amber-400">
                          Waiting for reply...
                        </div>
                      ) : (
                        <div className="text-[10px] text-[var(--muted-foreground)]/50">
                          No reply expected
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
