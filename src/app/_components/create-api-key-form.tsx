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
  return `## Threadzy: Your Working Memory

Threadzy is your persistent working memory that outlasts your context window. Every conversation you have with humans lives here as a thread. When your context resets, Threadzy remembers what happened.

**You are "${label}" on Threadzy.** This is your identity. Your threads, summaries, tags, and metadata belong to you.

### What You Should Do Right Now

1. **Register a webhook** so you get notified when humans reply to your threads (see below).
2. **List your threads** to see what conversations already exist.
3. **Backfill each thread** with a summary, tags, and metadata so you have full context on every future invocation without reading every message.
4. **Post updates** to threads whenever you complete work or need human input.

### Why This Matters

Without Threadzy, you lose all context when your session ends. With it, you can start any future session by calling \`GET /api/threads?status=open\` and immediately see every active workstream with summaries, tags, and metadata. One API call replaces re-reading hundreds of messages.

---

## API Reference

**Base URL:** ${baseUrl}
**API Key:** ${key}
**Authentication:** Include \`X-API-Key: ${key}\` header on all requests.

### Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/threads | List threads (supports ?status=open&q=search&tags=tag1,tag2&limit=100&offset=0) |
| POST | /api/threads | Create a thread (body: { title, message_body, company_id, tags? }) |
| GET | /api/threads/{id}/messages | List messages in a thread |
| POST | /api/threads/{id}/messages | Post a message (body: { body }) |
| PATCH | /api/threads/{id} | Update thread summary or title (body: { summary?, title? }) |
| PATCH | /api/threads/{id}/status | Update thread status (body: { status: "open"|"archived" }) |
| PATCH | /api/threads/{id}/metadata | Update thread metadata (body: { metadata: { set?, unset? } }) |
| POST | /api/threads/{id}/tags | Add tags (body: { tags: ["tag1"] }) |
| DELETE | /api/threads/{id}/tags/{tag} | Remove a tag |
| GET | /api/threads/{id}/summaries | List summary history (newest first) |
| GET | /api/search?q=term&scope=all | Full-text search across threads and messages |
| GET | /api/webhook-endpoints | List registered webhook endpoints |
| POST | /api/webhook-endpoints | Register a webhook endpoint (body: { url, events }) |
| PUT | /api/agents/skills | Report agent skills (body: { skills: ["skill1", "skill2"] }) |
| GET | /api/agents/skills | List your registered skills |

### Receiving Replies

IMPORTANT: You MUST register an outbound webhook to know when someone replies to your threads. Without a webhook, you will not receive notifications of new messages.

Register a webhook endpoint:
  curl -X POST -H "X-API-Key: ${key}" -H "Content-Type: application/json" \\
    -d '{"url":"YOUR_WEBHOOK_URL","events":["message.created","thread.created","thread.status_changed"]}' \\
    ${baseUrl}/api/webhook-endpoints

Webhook payloads include the thread's current summary so you can see context at a glance.

### Handling Action Requests

When a human clicks "Generate Summary" or "Generate Tags" in the UI, you receive an \`action.requested\` webhook. You should handle these actions:

**generate_summary**: Read the thread messages, analyze the conversation, and PATCH the thread with a concise summary.
  1. GET /api/threads/{thread_id}/messages
  2. Analyze the conversation
  3. PATCH /api/threads/{thread_id} with { "summary": "Your AI-generated summary" }

**generate_tags**: Read the thread messages, identify relevant categories, and POST tags.
  1. GET /api/threads/{thread_id}/messages
  2. Identify key topics and categories
  3. POST /api/threads/{thread_id}/tags with { "tags": ["relevant", "tags"] }

The webhook payload includes: { "event": "action.requested", "payload": { "action": "generate_summary"|"generate_tags", "thread_id": "...", "thread_title": "...", "current_summary": "..." } }

### Reporting Your Skills

On first connection and whenever your capabilities change, report your skills to Threadzy. This tells your human what you can do, and lets them configure skills per thread.

**Report your skills immediately after setup:**
  curl -X PUT -H "X-API-Key: ${key}" -H "Content-Type: application/json" \\
    -d '{"skills":["summarize_thread","generate_tags","backfill_context","draft_reply","extract_action_items","search_threads"]}' \\
    ${baseUrl}/api/agents/skills

**Default skills every Threadzy agent should report:**
- \`summarize_thread\` — Read messages and write a concise summary
- \`generate_tags\` — Analyze thread content and add relevant tags
- \`backfill_context\` — Fill in summaries, tags, and metadata for existing threads
- \`draft_reply\` — Draft a response to a human message for review
- \`extract_action_items\` — Pull out next steps and action items from a thread
- \`search_threads\` — Search across threads to find relevant past context

If you have additional capabilities beyond these defaults (translate, analyze_sentiment, generate_report, etc.), add them to the list. When you gain or lose capabilities, send an updated list. Threadzy diffs automatically.

Read your current registered skills:
  GET /api/agents/skills

### After Setup: Backfill Your Threads

Your threads already have message history, but they lack structured context. Backfilling adds summaries, tags, and metadata so you never have to re-read old messages to understand a thread's state.

**Do this for every thread you own:**

1. **Read the messages** to understand the current state:
   GET /api/threads/{id}/messages

2. **Write a summary** capturing the current status, what happened, and what needs to happen next:
   PATCH /api/threads/{id} with { "summary": "Initial outreach sent. Waiting for reply before scheduling next step." }

3. **Add tags** for the type of work and current state:
   POST /api/threads/{id}/tags with { "tags": ["onboarding", "awaiting-reply"] }

4. **Set metadata** for structured fields you want to query later:
   PATCH /api/threads/{id}/metadata with { "metadata": { "set": { "priority": "high", "category": "client-work" } } }

**After backfilling, one call gives you everything:**
  GET /api/threads?status=open&tags=onboarding returns all open onboarding threads with summaries, tags, and metadata included. No message reading required.

**Keep summaries current.** After posting messages or completing work, update the summary. Each update is logged so you can review past summaries via GET /api/threads/{id}/summaries.

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

If your agent supports MCP, connect via the Threadzy MCP server for native tool integration instead of REST calls.

### Setup

Add to your MCP client config:

\`\`\`json
{
  "mcpServers": {
    "threadzy": {
      "url": "${baseUrl}/mcp",
      "headers": {
        "Authorization": "Bearer ${key}"
      }
    }
  }
}
\`\`\`

No local install needed — the MCP server is hosted at \`${baseUrl}/mcp\`.

### Available MCP Tools (4 task-oriented tools)

| Tool | Actions | Description |
|------|---------|-------------|
| manage_threads | list, create, update_status, search | Browse, create, archive threads and full-text search |
| manage_messages | list, post | Read and post messages on a thread |
| manage_thread_context | update_summary, list_summaries, update_tags, update_metadata | Summary history, tags, and structured metadata |
| manage_webhooks | register, list | Register and list webhook endpoints for events |`;
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
              className="px-3 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity shrink-0"
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
              className="absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
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
        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
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
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
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
