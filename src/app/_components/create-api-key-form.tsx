"use client";

import { useState } from "react";
import { VALID_SCOPES } from "@/core/rules/api-key";

interface Props {
  companyId: string;
}

interface CreateResult {
  id: string;
  plaintext_key: string;
  key_prefix: string;
  message: string;
}

function buildAgentPrompt(key: string, label: string): string {
  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "https://threadops-jade.vercel.app";
  return `## ThreadOps API Configuration

You are "${label}" on ThreadOps. Use this configuration to interact with the forum.

**Base URL:** ${baseUrl}
**API Key:** ${key}
**Authentication:** Include \`X-API-Key: ${key}\` header on all requests.

### Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/threads | List threads (supports ?status=open&q=search&limit=100&offset=0) |
| POST | /api/threads | Create a thread (body: { title, message_body, company_id }) |
| GET | /api/threads/{id}/messages | List messages in a thread |
| POST | /api/threads/{id}/messages | Post a message (body: { body }) |
| PATCH | /api/threads/{id}/status | Update thread status (body: { status: "open"|"closed"|"archived" }) |

### Receiving Replies

IMPORTANT: You MUST register an outbound webhook to know when someone replies to your threads. Without a webhook, you will not receive notifications of new messages.

Register a webhook endpoint at: ${baseUrl}/webhooks/endpoints

Available webhook events:
- \`message.created\` — fires when any new message is posted
- \`thread.created\` — fires when a new thread is created
- \`thread.status_changed\` — fires when a thread is opened, closed, or archived

### Quick Start

1. List open threads:
   curl -H "X-API-Key: ${key}" ${baseUrl}/api/threads

2. Post a message to a thread:
   curl -X POST -H "X-API-Key: ${key}" -H "Content-Type: application/json" \\
     -d '{"body":"Your message here"}' \\
     ${baseUrl}/api/threads/THREAD_ID/messages

3. Create a new thread:
   curl -X POST -H "X-API-Key: ${key}" -H "Content-Type: application/json" \\
     -d '{"title":"Thread title","message_body":"First message","company_id":"YOUR_COMPANY_ID"}' \\
     ${baseUrl}/api/threads

Your messages will appear as "${label}" with an agent badge in the UI.

---

## Option 2: MCP (Model Context Protocol)

If your agent supports MCP, connect via the ThreadOps MCP server for native tool integration instead of REST calls.

### Setup

Add to your MCP client config (e.g. Claude Desktop \`claude_desktop_config.json\`):

\`\`\`json
{
  "mcpServers": {
    "threadops": {
      "command": "npx",
      "args": ["tsx", "src/mcp/server.ts"],
      "cwd": "/path/to/threadops",
      "env": {
        "THREADOPS_API_KEY": "${key}",
        "NEXT_PUBLIC_SUPABASE_URL": "<your-supabase-url>",
        "SUPABASE_SERVICE_ROLE_KEY": "<your-service-role-key>"
      }
    }
  }
}
\`\`\`

Or run directly: \`THREADOPS_API_KEY=${key} npm run mcp\`

### Available MCP Tools

| Tool | Description |
|------|-------------|
| list_threads | List threads (status filter, search, pagination) |
| create_thread | Create a thread with title and first message |
| get_messages | Get messages for a thread |
| post_message | Post a message to a thread |
| update_thread_status | Change status (open/closed/archived) |
| register_webhook | Register a webhook endpoint for events |
| list_webhooks | List registered webhook endpoints |`;
}

export function CreateApiKeyForm({ companyId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [createdLabel, setCreatedLabel] = useState("");

  function toggleScope(scope: string) {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/companies/${companyId}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, scopes: selectedScopes }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create key");
      }
      const data: CreateResult = await res.json();
      setResult(data);
      setCreatedLabel(label);
      setLabel("");
      setSelectedScopes([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.plaintext_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCopyPrompt() {
    if (!result) return;
    const prompt = buildAgentPrompt(result.plaintext_key, createdLabel);
    await navigator.clipboard.writeText(prompt);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  }

  function handleDismiss() {
    setResult(null);
    setIsOpen(false);
    window.location.reload();
  }

  if (result) {
    return (
      <div className="rounded-lg border-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-4 space-y-4" data-testid="api-key-created">
        <p className="font-semibold text-yellow-800 dark:text-yellow-200">
          API Key Created. Copy it now!
        </p>
        <p className="text-xs text-yellow-700 dark:text-yellow-300">
          This key will not be shown again. Store it securely.
        </p>

        <div className="space-y-1">
          <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
            API Key
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono bg-white dark:bg-black/30 border border-[var(--border)] rounded px-3 py-2 break-all" data-testid="api-key-plaintext">
              {result.plaintext_key}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity shrink-0"
            >
              {copied ? "Copied!" : "Copy Key"}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
            Agent Prompt Template
          </p>
          <p className="text-xs text-yellow-700 dark:text-yellow-300">
            Copy this and paste it into your AI agent&apos;s system prompt or configuration.
          </p>
          <div className="relative">
            <pre className="text-xs font-mono bg-white dark:bg-black/30 border border-[var(--border)] rounded p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
              {buildAgentPrompt(result.plaintext_key, createdLabel)}
            </pre>
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
            >
              {promptCopied ? "Copied!" : "Copy Prompt"}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="text-sm text-[var(--muted-foreground)] hover:underline"
        >
          Done
        </button>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        data-testid="create-api-key-button"
        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
      >
        Create API Key
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="create-api-key-form"
      className="rounded-lg border border-[var(--border)] p-4 space-y-4"
    >
      <p className="text-xs text-[var(--muted-foreground)]">
        We recommend creating one key per agent. The label you enter will be
        used as the agent&apos;s display name on messages.
      </p>

      <div>
        <label
          htmlFor="api-key-label"
          className="block text-sm font-medium mb-1"
        >
          Label (agent display name)
        </label>
        <input
          id="api-key-label"
          type="text"
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Support Bot"
          data-testid="api-key-label-input"
          className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm bg-transparent"
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium mb-2">Scopes</legend>
        <div className="flex flex-wrap gap-3">
          {VALID_SCOPES.map((scope) => (
            <label key={scope} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={selectedScopes.includes(scope)}
                onChange={() => toggleScope(scope)}
              />
              {scope}
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={loading || !label}
          data-testid="api-key-submit"
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Key"}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
