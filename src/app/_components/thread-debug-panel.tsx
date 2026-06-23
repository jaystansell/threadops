"use client";

import { useState } from "react";

interface ThreadDebugPanelProps {
  threadId: string;
  agentName: string | null;
  threadTitle: string;
  messageCount: number;
  lastMessageAt: string | null;
  isAgentRevoked: boolean;
}

function buildDiagnosticPrompt({
  threadId,
  agentName,
  threadTitle,
  messageCount,
  lastMessageAt,
  isAgentRevoked,
  baseUrl,
}: ThreadDebugPanelProps & { baseUrl: string }): string {
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
    lines.push("WARNING: This agent's API key has been REVOKED. No webhooks will be delivered.");
    lines.push("Action: Create a new API key and update your webhook endpoint.");
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("I'm not receiving responses from you in this Threadzy thread. Please diagnose:");
  lines.push("");
  lines.push("1. WEBHOOK CHECK: Are you receiving `message.created` webhook events from Threadzy?");
  lines.push(`   - Your endpoint should be registered at: ${baseUrl}/webhooks/endpoints`);
  lines.push("   - Check if your endpoint URL is correct and returning HTTP 200");
  lines.push("   - Check webhook delivery logs for errors");
  lines.push("");
  lines.push("2. AUTH CHECK: Is your API key valid and not revoked?");
  lines.push(`   - Verify at: ${baseUrl}/api-keys`);
  lines.push("   - If revoked, create a new key and update your webhook endpoint config");
  lines.push("");
  lines.push("3. ECHO FILTER: Are you filtering by `author_kind`?");
  lines.push('   - Only respond to events where `author_kind: "user"` — skip `author_kind: "agent"` (those are your own messages echoed back)');
  lines.push('   - Or register your endpoint with filter: `{"author_kind": "user"}` to skip echoes server-side');
  lines.push("");
  lines.push("4. RESPONSE CHECK: When you receive a webhook, are you posting back correctly?");
  lines.push(`   - POST ${baseUrl}/api/threads/${threadId}/messages`);
  lines.push('   - Headers: `X-API-Key: <your-key>`, `Content-Type: application/json`');
  lines.push('   - Body: `{"body": "your response text"}`');
  lines.push("");
  lines.push("5. OWNERSHIP CHECK: Does this thread belong to you?");
  lines.push("   - Agents can only post to threads they own or unowned threads");
  lines.push("   - If you get a 403 error, the thread belongs to another agent");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("Threadzy Documentation:");
  lines.push(`- API Docs: ${baseUrl}/docs/api`);
  lines.push(`- Webhook Setup: ${baseUrl}/docs/api#webhook-endpoints`);
  lines.push(`- Security & Auth: ${baseUrl}/security`);
  lines.push("");
  lines.push("Please check your logs for the most recent webhook delivery and report back what you find.");

  return lines.join("\n");
}

export function ThreadDebugPanel(props: ThreadDebugPanelProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://threadops-jade.vercel.app";

  const prompt = buildDiagnosticPrompt({ ...props, baseUrl });

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50 transition-colors"
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
        Agent not responding? Copy diagnostic prompt
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
              Copy this prompt and send it to your agent to diagnose why it&apos;s not responding
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(prompt);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex items-center gap-1.5 px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--primary)] transition-colors"
            >
              {copied ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
