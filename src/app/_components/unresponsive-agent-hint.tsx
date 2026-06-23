"use client";

import { useState, useEffect } from "react";

interface UnresponsiveAgentHintProps {
  lastUserMessageAt: string;
  lastAgentMessageAt: string | null;
  agentName: string | null;
  diagnosticPrompt: string;
  threadId: string;
}

const THRESHOLD_MS = 5 * 60 * 1000;

export function UnresponsiveAgentHint({
  lastUserMessageAt,
  lastAgentMessageAt,
  agentName,
  diagnosticPrompt,
  threadId,
}: UnresponsiveAgentHintProps) {
  const [visible, setVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);

  // Check timestamps and poll for new messages to auto-clear when agent responds
  useEffect(() => {
    let userAt = lastUserMessageAt;
    let agentAt = lastAgentMessageAt;

    function check() {
      const userTs = new Date(userAt).getTime();
      const agentTs = agentAt ? new Date(agentAt).getTime() : 0;
      if (agentTs > userTs) {
        setVisible(false);
        return;
      }
      const diff = Date.now() - userTs;
      setVisible(diff > THRESHOLD_MS);
      setElapsed(Math.round(diff / 60_000));
    }

    async function poll() {
      try {
        const res = await fetch(`/api/threads/${threadId}/messages`);
        if (!res.ok) return;
        const msgs = (await res.json()) as Array<{ author_kind: string; created_at: string }>;
        const lastUser = [...msgs].reverse().find((m) => m.author_kind === "user");
        const lastAgent = [...msgs].reverse().find((m) => m.author_kind === "agent");
        if (lastUser) userAt = lastUser.created_at;
        if (lastAgent) agentAt = lastAgent.created_at;
      } catch { /* ignore */ }
      check();
    }

    check();
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, [lastUserMessageAt, lastAgentMessageAt, threadId]);

  if (!visible) return null;

  return (
    <div
      className="mt-2 rounded-lg border border-amber-500/40 bg-amber-950/20 px-3 py-2"
      style={{ animation: "border-shimmer 3s ease-in-out infinite" }}
    >
      <div className="flex items-start gap-2">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-amber-400 shrink-0 mt-0.5"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-amber-300 font-medium">
            {agentName ?? "Agent"} hasn&apos;t responded in {elapsed}+ minutes
          </p>
          <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
            Copy the diagnostic prompt below and send it to your agent to
            troubleshoot
          </p>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(diagnosticPrompt);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="mt-1.5 flex items-center gap-1.5 px-2 py-1 text-xs rounded border border-amber-500/30 bg-amber-950/30 text-amber-300 hover:text-amber-200 hover:border-amber-400/50 transition-colors"
          >
            {copied ? (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied diagnostic prompt
              </>
            ) : (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                Copy diagnostic prompt
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
