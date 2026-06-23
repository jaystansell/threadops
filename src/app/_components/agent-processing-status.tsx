"use client";

import { useEffect, useState } from "react";

type ProcessingStatus = "acknowledged" | "processing" | "completed" | "escalated" | null;

interface StatusResponse {
  status: ProcessingStatus;
  updated_at: string | null;
  agent_name: string | null;
}

interface AgentProcessingStatusProps {
  threadId: string;
  isAwaiting: boolean;
}

export function AgentProcessingStatus({ threadId, isAwaiting }: AgentProcessingStatusProps) {
  const [data, setData] = useState<StatusResponse | null>(null);

  useEffect(() => {
    if (!isAwaiting) return;

    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await fetch(`/api/threads/${threadId}/status`);
        if (!res.ok) return;
        const json: StatusResponse = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // Silently handle network errors
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [threadId, isAwaiting]);

  if (!data || !data.status || data.status === "completed") return null;

  const agentLabel = data.agent_name ?? "Agent";

  if (data.status === "acknowledged") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-400">
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <span>{agentLabel} received your message</span>
      </div>
    );
  }

  if (data.status === "processing") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-500/20 bg-blue-500/5 text-xs text-blue-400">
        <svg className="w-3.5 h-3.5 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span className="animate-pulse">{agentLabel} is working on this&hellip;</span>
      </div>
    );
  }

  if (data.status === "escalated") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs text-amber-400">
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>{agentLabel} escalated this &mdash; manual follow-up needed</span>
      </div>
    );
  }

  return null;
}
