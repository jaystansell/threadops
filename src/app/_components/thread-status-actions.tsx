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

      router.refresh();
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
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] disabled:opacity-50 transition-colors"
        >
          {updating ? "..." : action.label}
        </button>
      ))}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
