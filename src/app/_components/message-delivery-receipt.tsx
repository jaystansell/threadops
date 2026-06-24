"use client";

import { useState, useEffect } from "react";

interface DeliveryStage {
  label: string;
  status: "complete" | "pending" | "failed" | "inactive";
  timestamp: string | null;
  detail: string | null;
}

interface WebhookData {
  delivery_id: string;
  event_type: string;
  endpoint_url_masked: string | null;
  http_status: number | null;
  latency_ms: number | null;
  fired_at: string;
  responded_at: string | null;
  last_error: string | null;
}

interface AckData {
  ack_at: string;
}

interface ReplyData {
  message_id: string;
  author_name: string | null;
  body_preview: string;
  replied_at: string;
}

interface DeliveryReceiptData {
  stages: DeliveryStage[];
  overall_status:
    | "delivered"
    | "acknowledged"
    | "replied"
    | "pending"
    | "failed";
  webhook: WebhookData | null;
  ack: AckData | null;
  reply: ReplyData | null;
}

interface MessageDeliveryReceiptProps {
  threadId: string;
  messageId: string;
  authorKind: string;
}

const STATUS_ICONS: Record<string, string> = {
  pending: "⏳",
  delivered: "📤",
  acknowledged: "🤖",
  replied: "💬",
  failed: "❌",
};

function stageIcon(label: string, status: DeliveryStage["status"]): string {
  if (status === "inactive") return "○";
  if (status === "failed") return "❌";
  if (status === "pending") return "⏳";
  switch (label) {
    case "Webhook Fired":
      return "📤";
    case "HTTP Response":
      return "✓";
    case "Agent ACK":
      return "🤖";
    case "Agent Reply":
      return "💬";
    default:
      return "✓";
  }
}

function statusColor(
  status: DeliveryStage["status"],
): string {
  switch (status) {
    case "complete":
      return "text-green-500";
    case "pending":
      return "text-amber-500";
    case "failed":
      return "text-red-500";
    case "inactive":
      return "text-[var(--muted-foreground)]/30";
  }
}

function formatTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function CompactView({ data }: { data: DeliveryReceiptData }) {
  const parts: string[] = [];
  for (const stage of data.stages) {
    const icon = stageIcon(stage.label, stage.status);
    if (stage.label === "HTTP Response" && stage.status === "complete") {
      const code = data.webhook?.http_status ?? 200;
      parts.push(`✓${code}`);
    } else {
      parts.push(icon);
    }
  }

  const overallColor =
    data.overall_status === "replied"
      ? "text-green-400"
      : data.overall_status === "failed"
        ? "text-red-400"
        : "text-amber-400";

  return (
    <span className={`font-mono text-[10px] ${overallColor}`}>
      {parts.join(" → ")}
    </span>
  );
}

function DetailRow({
  stage,
  extraDetail,
}: {
  stage: DeliveryStage;
  extraDetail?: React.ReactNode;
}) {
  const color = statusColor(stage.status);
  const icon = stageIcon(stage.label, stage.status);

  return (
    <div className="flex items-start gap-2">
      <span className={`flex-shrink-0 text-xs ${color}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-semibold ${stage.status === "inactive" ? "text-[var(--muted-foreground)]/50" : "text-[var(--foreground)]"}`}
          >
            {stage.label}
          </span>
          {stage.timestamp && (
            <span className="text-[10px] text-[var(--muted-foreground)]">
              {formatTimestamp(stage.timestamp)}
            </span>
          )}
        </div>
        {stage.detail && (
          <div className="text-[10px] text-[var(--muted-foreground)] truncate">
            {stage.detail}
          </div>
        )}
        {extraDetail}
      </div>
    </div>
  );
}

function ExpandedView({ data }: { data: DeliveryReceiptData }) {
  const webhookStage = data.stages[0];
  const httpStage = data.stages[1];
  const ackStage = data.stages[2];
  const replyStage = data.stages[3];

  return (
    <div className="mt-1.5 border border-[var(--border)] rounded-lg overflow-hidden">
      <div className="px-3 py-2.5 bg-[var(--background)]">
        {/* Progress dots */}
        <div className="flex items-center gap-0 mb-3">
          {data.stages.map((stage, i) => (
            <div key={stage.label} className="flex items-center">
              {i > 0 && (
                <div
                  className={`w-4 h-px flex-shrink-0 ${
                    stage.status === "complete"
                      ? "bg-green-500/50"
                      : stage.status === "pending"
                        ? "bg-amber-500/30"
                        : stage.status === "failed"
                          ? "bg-red-500/30"
                          : "bg-[var(--muted-foreground)]/15"
                  }`}
                />
              )}
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  stage.status === "complete"
                    ? "bg-green-500"
                    : stage.status === "pending"
                      ? "bg-amber-500 animate-pulse"
                      : stage.status === "failed"
                        ? "bg-red-500"
                        : "bg-[var(--muted-foreground)]/30"
                }`}
              />
            </div>
          ))}
          <span className="ml-2 text-[10px] text-[var(--muted-foreground)]">
            {data.overall_status === "replied"
              ? "Complete"
              : data.overall_status === "failed"
                ? "Failed"
                : "In progress"}
          </span>
        </div>

        <div className="space-y-2 font-mono text-[11px] leading-relaxed">
          <DetailRow
            stage={webhookStage}
            extraDetail={
              data.webhook?.endpoint_url_masked ? (
                <div className="text-[10px] text-[var(--muted-foreground)] truncate">
                  → {data.webhook.endpoint_url_masked}
                </div>
              ) : undefined
            }
          />
          <DetailRow
            stage={httpStage}
            extraDetail={
              data.webhook?.last_error && data.webhook.http_status === null ? (
                <div className="text-[10px] text-red-400/80 truncate">
                  {data.webhook.last_error}
                </div>
              ) : undefined
            }
          />
          <DetailRow stage={ackStage} />
          <DetailRow
            stage={replyStage}
            extraDetail={
              data.reply ? (
                <div className="text-[10px] text-green-400">
                  Replied by {data.reply.author_name ?? "agent"}
                </div>
              ) : replyStage.status === "pending" ? (
                <div className="text-[10px] text-amber-400">
                  Waiting for reply…
                </div>
              ) : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}

export function MessageDeliveryReceipt({
  threadId,
  messageId,
  authorKind,
}: MessageDeliveryReceiptProps) {
  const [data, setData] = useState<DeliveryReceiptData | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const isUserMessage = authorKind === "user";

  // Auto-fetch on mount for user messages
  useEffect(() => {
    if (!isUserMessage) return;
    const timer = setTimeout(() => {
      fetch(`/api/threads/${threadId}/messages/${messageId}/delivery`)
        .then((res) => (res.ok ? res.json() : null))
        .then((d) => {
          if (d && d.webhook) setData(d);
        })
        .catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [threadId, messageId, isUserMessage]);

  if (!isUserMessage) return null;
  if (!data) return null;

  const overallIcon = STATUS_ICONS[data.overall_status] ?? "📤";
  const overallLabel =
    data.overall_status === "replied"
      ? "Replied"
      : data.overall_status === "acknowledged"
        ? "Acknowledged"
        : data.overall_status === "delivered"
          ? "Delivered"
          : data.overall_status === "failed"
            ? "Failed"
            : "Pending";

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => {
          if (!open) setLoading(true);
          setOpen(!open);
          if (!open) {
            fetch(
              `/api/threads/${threadId}/messages/${messageId}/delivery`,
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
        <span className="flex items-center gap-1.5">
          <span>{overallIcon} {overallLabel}</span>
          <span className="text-[var(--muted-foreground)]/40">·</span>
          <CompactView data={data} />
        </span>
      </button>

      {open && (
        loading ? (
          <div className="mt-1.5 text-[10px] text-[var(--muted-foreground)]">
            Loading…
          </div>
        ) : (
          <ExpandedView data={data} />
        )
      )}
    </div>
  );
}
