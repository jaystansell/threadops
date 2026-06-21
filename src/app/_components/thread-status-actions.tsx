"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ThreadStatus } from "@/core/types";

interface ThreadStatusActionsProps {
  threadId: string;
  companyId: string;
  currentStatus: ThreadStatus;
}

const STATUS_ACTIONS: Record<
  ThreadStatus,
  { label: string; target: ThreadStatus }[]
> = {
  open: [
    { label: "Archive", target: "archived" },
  ],
  archived: [
    { label: "Reopen", target: "open" },
  ],
};

export function ThreadStatusActions({
  threadId,
  companyId,
  currentStatus,
}: ThreadStatusActionsProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actions = STATUS_ACTIONS[currentStatus];
  if (actions.length === 0) return null;

  async function handleStatusChange(newStatus: ThreadStatus) {
    setUpdating(true);
    setError(null);

    try {
      const res = await fetch(`/api/threads/${threadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, company_id: companyId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }

      if (newStatus === "archived") {
        router.push("/threads");
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="flex items-center gap-2" data-testid="thread-status-actions">
      {actions.map((action) => (
        <button
          key={action.target}
          onClick={() => handleStatusChange(action.target)}
          disabled={updating}
          data-testid={`status-action-${action.target}`}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50 transition-colors flex items-center gap-1.5 ${
            action.target === "archived"
              ? "bg-amber-600/15 text-amber-400 border border-amber-500/30 hover:bg-amber-600/25"
              : "bg-emerald-600/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/25"
          }`}
        >
          {action.target === "archived" ? (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
          {updating ? "..." : action.label}
        </button>
      ))}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
