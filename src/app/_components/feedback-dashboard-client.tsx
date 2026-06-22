"use client";

import { useState } from "react";
import type { AgentFeedback, AgentFeedbackStatus } from "@/core/types";

const STATUS_ORDER: AgentFeedbackStatus[] = ["pending", "approved", "shipped", "rejected"];

const STATUS_TABS: { value: AgentFeedbackStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "shipped", label: "Shipped" },
  { value: "rejected", label: "Rejected" },
];

const CATEGORY_COLORS: Record<string, string> = {
  webhook_filter: "bg-blue-900 text-blue-300",
  api_feature: "bg-purple-900 text-purple-300",
  payload_field: "bg-cyan-900 text-cyan-300",
  bug_report: "bg-red-900 text-red-300",
  general: "bg-gray-700 text-gray-300",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-900 text-red-300",
  medium: "bg-yellow-900 text-yellow-300",
  low: "bg-green-900 text-green-300",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-900 text-yellow-300",
  approved: "bg-green-900 text-green-300",
  shipped: "bg-blue-900 text-blue-300",
  rejected: "bg-red-900 text-red-300",
};

interface Props {
  initialFeedback: AgentFeedback[];
  keyLabelMap: Record<string, string>;
}

export function FeedbackDashboardClient({ initialFeedback, keyLabelMap }: Props) {
  const [feedback, setFeedback] = useState(initialFeedback);
  const [activeTab, setActiveTab] = useState<AgentFeedbackStatus | "all">("all");
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const filtered = activeTab === "all"
    ? [...feedback].sort((a, b) => {
        const ai = STATUS_ORDER.indexOf(a.status);
        const bi = STATUS_ORDER.indexOf(b.status);
        if (ai !== bi) return ai - bi;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
    : feedback
        .filter((f) => f.status === activeTab)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const counts: Record<string, number> = { all: feedback.length };
  for (const s of STATUS_ORDER) {
    counts[s] = feedback.filter((f) => f.status === s).length;
  }

  async function handleStatusChange(id: string, newStatus: AgentFeedbackStatus) {
    setLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const body: Record<string, string> = { status: newStatus };
      const notes = actionNotes[id]?.trim();
      if (notes) body.admin_notes = notes;

      const res = await fetch(`/api/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to update");

      const updated = await res.json();
      setFeedback((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...updated } : f)),
      );
      setActionNotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch {
      // Silently fail — user will see no state change
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <div className="space-y-4">
      {/* Status filter tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === tab.value
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]/80"
            }`}
          >
            {tab.label} ({counts[tab.value] ?? 0})
          </button>
        ))}
      </div>

      {/* Feedback cards */}
      {filtered.length === 0 ? (
        <div className="rounded border border-[var(--border)] bg-[var(--muted)]/30 p-6 text-center">
          <p className="text-sm text-[var(--muted-foreground)] font-mono">
            No feedback items{activeTab !== "all" ? ` with status "${activeTab}"` : ""}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const agentName = keyLabelMap[item.api_key_id] ?? "Unknown Agent";
            const isLoading = loading[item.id] ?? false;

            return (
              <div
                key={item.id}
                className="rounded-lg border border-[var(--border)] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate">{item.title}</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {agentName}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[item.category] ?? ""}`}>
                        {item.category.replace("_", " ")}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[item.priority] ?? ""}`}>
                        {item.priority}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status] ?? ""}`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-[var(--muted-foreground)] whitespace-nowrap tabular-nums">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                  {item.description}
                </p>

                {item.admin_notes && (
                  <div className="text-xs bg-[var(--muted)]/50 rounded p-2">
                    <span className="font-medium">Admin notes:</span> {item.admin_notes}
                  </div>
                )}

                {/* Action area for non-terminal states */}
                {(item.status === "pending" || item.status === "approved") && (
                  <div className="flex items-end gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Optional notes..."
                      value={actionNotes[item.id] ?? ""}
                      onChange={(e) =>
                        setActionNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      className="flex-1 px-2 py-1 text-xs rounded border border-[var(--border)] bg-transparent focus:outline-none focus:border-[var(--primary)]"
                    />
                    {item.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleStatusChange(item.id, "approved")}
                          disabled={isLoading}
                          className="px-3 py-1 text-xs font-medium rounded bg-green-800 text-green-200 hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleStatusChange(item.id, "rejected")}
                          disabled={isLoading}
                          className="px-3 py-1 text-xs font-medium rounded bg-red-800 text-red-200 hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {item.status === "approved" && (
                      <button
                        onClick={() => handleStatusChange(item.id, "shipped")}
                        disabled={isLoading}
                        className="px-3 py-1 text-xs font-medium rounded bg-blue-800 text-blue-200 hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                        Mark Shipped
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
