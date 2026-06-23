"use client";

import { useState, useEffect } from "react";

interface ThreadDebugPanelProps {
  threadId: string;
  agentName: string | null;
  threadTitle: string;
  messageCount: number;
  lastMessageAt: string | null;
  lastUserMessageAt: string | null;
  lastAgentMessageAt: string | null;
  isAgentRevoked: boolean;
}

const UNRESPONSIVE_THRESHOLD_MS = 5 * 60 * 1000;

function isAgentUnresponsive(
  lastUserMessageAt: string | null,
  lastAgentMessageAt: string | null,
): boolean {
  if (!lastUserMessageAt) return false;
  const userTs = new Date(lastUserMessageAt).getTime();
  const agentTs = lastAgentMessageAt
    ? new Date(lastAgentMessageAt).getTime()
    : 0;
  if (agentTs > userTs) return false;
  return Date.now() - userTs > UNRESPONSIVE_THRESHOLD_MS;
}

function buildDiagnosticPrompt({
  threadId,
  agentName,
  threadTitle,
  messageCount,
  lastMessageAt,
  isAgentRevoked,
  baseUrl,
}: Omit<ThreadDebugPanelProps, "lastUserMessageAt" | "lastAgentMessageAt"> & {
  baseUrl: string;
}): string {
  const lines: string[] = [];

  lines.push("=== Threadzy Agent Diagnostic ===");
  lines.push("");
  lines.push(`Thread: "${threadTitle}"`);
  lines.push(`Thread ID: ${threadId}`);
  if (agentName) lines.push(`Agent: ${agentName}`);
  lines.push(`Messages in thread: ${messageCount}`);
  if (lastMessageAt) lines.push(`Last message: ${lastMessageAt}`);
  if (isAgentRevoked) {
    lines.push("");
    lines.push(
      "WARNING: This agent's API key has been REVOKED. No webhooks will be delivered.",
    );
    lines.push(
      "Action: Create a new API key and update your webhook endpoint.",
    );
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    "I'm not receiving responses from you in this Threadzy thread. Please diagnose:",
  );
  lines.push("");
  lines.push(
    "1. WEBHOOK CHECK: Are you receiving `message.created` webhook events from Threadzy?",
  );
  lines.push(
    `   - Your endpoint should be registered at: ${baseUrl}/webhooks/endpoints`,
  );
  lines.push(
    "   - Check if your endpoint URL is correct and returning HTTP 200",
  );
  lines.push("   - Check webhook delivery logs for errors");
  lines.push("");
  lines.push("2. AUTH CHECK: Is your API key valid and not revoked?");
  lines.push(`   - Verify at: ${baseUrl}/api-keys`);
  lines.push(
    "   - If revoked, create a new key and update your webhook endpoint config",
  );
  lines.push("");
  lines.push("3. ECHO FILTER: Are you filtering by `author_kind`?");
  lines.push(
    '   - Only respond to events where `author_kind: "user"` — skip `author_kind: "agent"` (those are your own messages echoed back)',
  );
  lines.push(
    '   - Or register your endpoint with filter: `{"author_kind": "user"}` to skip echoes server-side',
  );
  lines.push("");
  lines.push(
    "4. RESPONSE CHECK: When you receive a webhook, are you posting back correctly?",
  );
  lines.push(`   - POST ${baseUrl}/api/threads/${threadId}/messages`);
  lines.push(
    '   - Headers: `X-API-Key: <your-key>`, `Content-Type: application/json`',
  );
  lines.push('   - Body: `{"body": "your response text"}`');
  lines.push("");
  lines.push("5. OWNERSHIP CHECK: Does this thread belong to you?");
  lines.push(
    "   - Agents can only post to threads they own or unowned threads",
  );
  lines.push(
    "   - If you get a 403 error, the thread belongs to another agent",
  );
  lines.push("");
  lines.push(
    "6. FIELD NAME CHECK: Are you using the correct webhook payload field names?",
  );
  lines.push(
    '   - The top-level field is `event` (NOT `event_type`)',
  );
  lines.push(
    '   - Message data is in `payload` (NOT `data`)',
  );
  lines.push(
    '   - Correct: body.event === "message.created" && body.payload.author_kind === "user"',
  );
  lines.push(
    '   - WRONG: body.event_type, body.data.author_kind — these will silently reject every webhook',
  );
  lines.push(
    '   - Values for author_kind are "user" (human) or "agent". There is no "human" value.',
  );
  lines.push("");
  lines.push(
    "7. SUBAGENT HANDLER CHECK: Can your webhook handler actually act on the message?",
  );
  lines.push(
    "   - Receiving a webhook is only step 1. Your handler must autonomously process it.",
  );
  lines.push(
    "   - Common failure: handler receives the webhook, logs it, but cannot search emails, read SOPs, check calendars, or compose a substantive reply.",
  );
  lines.push(
    "   - Your handler needs access to all the tools required for multi-step work (context retrieval, composing replies, calling external APIs).",
  );
  lines.push(
    "   - If your handler just acknowledges the webhook and does nothing else, the human will see no response in Threadzy.",
  );
  lines.push(
    `   - Test by sending a message and checking: did your handler POST a reply to ${baseUrl}/api/threads/{thread_id}/messages?`,
  );
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("Threadzy Documentation:");
  lines.push(`- API Docs: ${baseUrl}/docs/api`);
  lines.push(`- Webhook Payloads: ${baseUrl}/docs/api#webhook-payloads`);
  lines.push(`- Webhook Setup: ${baseUrl}/docs/api#webhook-endpoints`);
  lines.push(`- Security & Auth: ${baseUrl}/security`);
  lines.push("");
  lines.push(
    "Please check your logs for the most recent webhook delivery and report back what you find.",
  );

  return lines.join("\n");
}

export function ThreadDebugPanel(props: ThreadDebugPanelProps) {
  const { lastUserMessageAt, lastAgentMessageAt, threadId, ...promptProps } = props;

  const [unresponsive, setUnresponsive] = useState(() =>
    isAgentUnresponsive(lastUserMessageAt, lastAgentMessageAt),
  );
  const [open, setOpen] = useState(() =>
    isAgentUnresponsive(lastUserMessageAt, lastAgentMessageAt),
  );
  const [copied, setCopied] = useState(false);
  const [liveMessageCount, setLiveMessageCount] = useState(props.messageCount);

  // Poll for new messages to auto-clear/auto-open when agent status changes
  useEffect(() => {
    let userAt = lastUserMessageAt;
    let agentAt = lastAgentMessageAt;
    let prevUnresponsive = isAgentUnresponsive(userAt, agentAt);

    function check() {
      const nowUnresponsive = isAgentUnresponsive(userAt, agentAt);
      setUnresponsive(nowUnresponsive);
      if (nowUnresponsive && !prevUnresponsive) setOpen(true);
      prevUnresponsive = nowUnresponsive;
    }

    async function poll() {
      try {
        const res = await fetch(`/api/threads/${threadId}/messages`);
        if (!res.ok) return;
        const messages = (await res.json()) as Array<{ author_kind: string; created_at: string }>;
        setLiveMessageCount(messages.length);
        const lastUser = [...messages].reverse().find((m) => m.author_kind === "user");
        const lastAgent = [...messages].reverse().find((m) => m.author_kind === "agent");
        if (lastUser) userAt = lastUser.created_at;
        if (lastAgent) agentAt = lastAgent.created_at;
      } catch { /* ignore */ }
      check();
    }

    check();
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, [lastUserMessageAt, lastAgentMessageAt, threadId]);

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://threadops-jade.vercel.app";

  const prompt = buildDiagnosticPrompt({ ...promptProps, threadId, messageCount: liveMessageCount, baseUrl });

  return (
    <div
      className={`border rounded-lg overflow-hidden ${
        unresponsive
          ? "border-amber-500/50"
          : "border-[var(--border)]"
      }`}
      style={
        unresponsive
          ? { animation: "border-shimmer 3s ease-in-out infinite" }
          : undefined
      }
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${
          unresponsive
            ? "text-amber-400 hover:bg-amber-950/30"
            : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50"
        }`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        {unresponsive
          ? "Agent not responding — copy diagnostic prompt to troubleshoot"
          : "Agent not responding? Copy diagnostic prompt"}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={`ml-auto transition-transform ${open ? "rotate-90" : ""}`}
        >
          <path d="M8 5l8 7-8 7z" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-[var(--border)] bg-[var(--background)]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
            <span className="text-[10px] text-[var(--muted-foreground)]">
              Copy this prompt and send it to your agent to diagnose why
              it&apos;s not responding
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(prompt);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex items-center gap-1.5 px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--primary)] transition-colors shrink-0"
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
                  Copied
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
                  Copy prompt
                </>
              )}
            </button>
          </div>
          <pre className="px-3 py-2 text-[11px] leading-relaxed text-[var(--muted-foreground)] whitespace-pre-wrap font-mono max-h-[300px] overflow-y-auto">
            {prompt}
          </pre>
        </div>
      )}
    </div>
  );
}

export { buildDiagnosticPrompt, isAgentUnresponsive };
export type { ThreadDebugPanelProps };
