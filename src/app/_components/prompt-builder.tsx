"use client";

import { useState, useMemo, useEffect } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PromptBuilderConfig {
  promptReady: boolean;
  hasWebhookUrl: boolean;
}

interface PromptBuilderProps {
  apiKey: string;
  agentLabel: string;
  onConfigChange?: (config: PromptBuilderConfig) => void;
}

interface PromptAnswers {
  hasWebhookUrl: "yes" | "no" | null;
  canSearchData: "yes" | "no" | "not_sure" | null;
  includePolling: "yes" | "no" | null;
  tools: Set<string>;
}

const TOOL_OPTIONS = [
  "Email",
  "Calendar",
  "File storage",
  "Web search",
  "Code execution",
  "Other",
] as const;

/* ------------------------------------------------------------------ */
/*  Tooltip helper prompts                                             */
/* ------------------------------------------------------------------ */

const TOOLTIP_PROMPTS: Record<string, string> = {
  hasWebhookUrl:
    "Do you have a publicly reachable URL that can receive HTTP POST requests? Reply with just Yes or No.",
  canSearchData:
    "Can you search emails, calendar events, and internal SOPs/documents on behalf of the user? Reply with Yes, No, or Not sure.",
  includePolling:
    "If your webhook goes down, can you fall back to polling an HTTP endpoint on a schedule? Reply with Yes or No.",
  tools:
    "Which of these tools do you have access to? Reply with a comma-separated list: Email, Calendar, File storage, Web search, Code execution, Other.",
};

/* ------------------------------------------------------------------ */
/*  Tooltip component                                                  */
/* ------------------------------------------------------------------ */

function AskAgentTooltip({ promptKey }: { promptKey: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const prompt = TOOLTIP_PROMPTS[promptKey];

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <span className="relative inline-block ml-1.5 align-middle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--border)] transition-colors text-[10px] font-bold leading-none"
        aria-label="Not sure? Ask your agent"
      >
        ?
      </button>
      {open && (
        <span className="absolute left-6 top-1/2 -translate-y-1/2 z-50 w-72 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 shadow-lg text-xs">
          <span className="block text-[var(--muted-foreground)] mb-1.5">
            Not sure? Ask your agent:
          </span>
          <span className="block font-mono text-[var(--foreground)] bg-[var(--muted)] rounded p-2 break-words whitespace-pre-wrap">
            {prompt}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="mt-2 px-2 py-1 text-[10px] font-medium rounded bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
          >
            {copied ? "Copied!" : "Copy prompt"}
          </button>
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Dynamic prompt generation                                          */
/* ------------------------------------------------------------------ */

function buildDynamicPrompt(
  key: string,
  label: string,
  answers: PromptAnswers,
): string {
  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://threadops-jade.vercel.app";

  const hasWebhook = answers.hasWebhookUrl === "yes";
  const wantsPolling = answers.includePolling === "yes";
  const selectedTools = [...answers.tools];

  let stepNumber = 1;

  /* --- Header --- */
  let prompt = `## Threadzy: Your Working Memory

Threadzy is your persistent working memory that outlasts your context window. Every conversation you have with humans lives here as a thread. When your context resets, Threadzy remembers what happened.

**You are "${label}" on Threadzy.** This is your identity. Your threads, summaries, tags, and metadata belong to you.

---

## MANDATORY SETUP — Complete These Steps NOW (in order)

Do NOT skip any step. Your human is watching the setup checklist on the API Keys page and will see if you missed something.
`;

  /* --- Webhook or Polling step --- */
  if (hasWebhook) {
    prompt += `
### Step ${stepNumber}: Register a Webhook (REQUIRED — do this FIRST)

Without a webhook you are DEAF. You will NOT know when humans reply to threads, when threads are created, or when actions are requested.

  curl -X POST -H "X-API-Key: ${key}" -H "Content-Type: application/json" \\
    -d '{"url":"YOUR_WEBHOOK_URL","events":["message.created","thread.created","thread.status_changed","action.requested"]}' \\
    ${baseUrl}/api/webhook-endpoints

Replace YOUR_WEBHOOK_URL with the URL where you receive incoming HTTP POST requests.

**Verify it worked:**
  curl -H "X-API-Key: ${key}" ${baseUrl}/api/webhook-endpoints

You should see your endpoint in the response. If the list is empty, your webhook was not registered. Try again.
`;
    stepNumber++;
  }

  if (!hasWebhook || wantsPolling) {
    const heading = hasWebhook
      ? `### Step ${stepNumber}: Set Up Polling Fallback`
      : `### Step ${stepNumber}: Set Up Polling (REQUIRED — do this FIRST)`;

    const description = hasWebhook
      ? "As a fallback in case your webhook goes down, poll for new activity periodically."
      : "Since you don't have a webhook URL, you'll need to poll for new messages and activity. Call this endpoint on a schedule (every 30–60 seconds recommended).";

    prompt += `
${heading}

${description}

**Poll for threads assigned to you:**
  curl -H "X-API-Key: ${key}" "${baseUrl}/api/threads/mine?status=open&limit=50"

This returns threads you own with their latest \`updated_at\` timestamps. Compare against your last-known timestamps to detect new activity.

**Check for new messages on active threads:**
  curl -H "X-API-Key: ${key}" "${baseUrl}/api/threads/{thread_id}/messages"

**Recommended polling loop:**
1. Call \`GET /api/threads/mine?status=open\` every 30–60 seconds
2. For each thread where \`updated_at\` has changed since your last poll, fetch new messages
3. Process new messages and respond as needed via \`POST /api/threads/{thread_id}/messages\`

Note: Polling uses more tokens than webhooks because you must check all threads regardless of activity.
`;
    stepNumber++;
  }

  /* --- Skills step --- */
  prompt += `
### Step ${stepNumber}: Report Your Skills

  curl -X PUT -H "X-API-Key: ${key}" -H "Content-Type: application/json" \\
    -d '{"skills":["summarize_thread","generate_tags","backfill_context","draft_reply","extract_action_items","search_threads"]}' \\
    ${baseUrl}/api/agents/skills

Add any additional skills you have beyond the defaults.
`;
  stepNumber++;

  /* --- Backfill step --- */
  prompt += `
### Step ${stepNumber}: List and Backfill Your Threads

  curl -H "X-API-Key: ${key}" ${baseUrl}/api/threads

For each thread, read messages, then write a summary, add tags, and set metadata.
`;
  stepNumber++;

  /* --- Confirm step --- */
  prompt += `
### Step ${stepNumber}: Confirm Setup

Post a message to any thread confirming you are connected:
  curl -X POST -H "X-API-Key: ${key}" -H "Content-Type: application/json" \\
    -d '{"body":"${label} connected to Threadzy.${hasWebhook ? " Webhook registered," : ""} Skills reported, ready to work."}' \\
    ${baseUrl}/api/threads/THREAD_ID/messages
`;

  /* --- Subagent handler / tool warnings --- */
  const limitedSearch =
    answers.canSearchData === "no" || answers.canSearchData === "not_sure";

  if (limitedSearch) {
    prompt += `
---

## IMPORTANT: Subagent Handler Capability Warning

Your webhook/polling handler must be able to **autonomously** process messages — search for context, compose substantive replies, and POST them back via \`/api/threads/{thread_id}/messages\`.

`;
    if (answers.canSearchData === "no") {
      prompt += `You indicated your agent **cannot** search emails, calendars, and SOPs. This means your handler may not be able to fully respond to human requests that require looking up external information. Consider connecting your agent to these data sources before going live.

`;
    } else {
      prompt += `You're **not sure** whether your agent can search emails, calendars, and SOPs. Verify this before going live — without access to these data sources, your handler may only be able to give generic responses.

`;
    }
  }

  if (selectedTools.length > 0 && selectedTools.length < TOOL_OPTIONS.length) {
    const missing = TOOL_OPTIONS.filter((t) => !answers.tools.has(t));
    if (missing.length > 0) {
      if (!limitedSearch) {
        prompt += `\n---\n\n`;
      }
      prompt += `**Agent tools:** ${selectedTools.join(", ")}
**Missing tools:** ${missing.join(", ")}
Some thread tasks may require tools your agent doesn't have. The agent should clearly communicate when it cannot fulfill a request due to missing tools.

`;
    }
  }

  /* --- API Reference --- */
  prompt += `
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
| GET | /api/threads/mine | List threads owned by the calling agent |
| GET | /api/threads/{id}/messages/{msgId}/attachments | List attachments on a message |
| GET | /api/threads/{id}/messages/{msgId}/attachments/{attId}/download | Get signed download URL |
`;

  /* --- Webhook envelope docs (always included) --- */
  prompt += `
### Receiving Replies
`;

  if (hasWebhook) {
    prompt += `
Webhook payloads include the thread's current summary so you can see context at a glance.

**Webhook envelope structure:** Every webhook POST body has this exact shape:
  { "event": "message.created", "payload": { ... }, "timestamp": "..." }

IMPORTANT: The top-level field is \`event\` (NOT \`event_type\`). Message fields like \`author_kind\` live inside \`payload\` (NOT inside \`data\`). Using the wrong field names will silently reject every webhook.

**Token-saving tip:** Check \`body.payload.author_kind\` FIRST and return immediately for \`"agent"\` events:

  parsed = JSON.parse(request.body)
  if parsed.event != "message.created":
      return  # not a message event
  if parsed.payload.author_kind == "agent":
      return  # nothing to do, save tokens
  # Process the message from parsed.payload.body
  # Reply via: POST /api/threads/{parsed.payload.thread_id}/messages

Only process webhooks where \`payload.author_kind == "user"\`. Values are \`"user"\` (human) or \`"agent"\`. There is no \`"human"\` value.
`;
  } else {
    prompt += `
Since you are using polling instead of webhooks, check for new messages by comparing \`updated_at\` timestamps from \`GET /api/threads/mine\`. When a thread has been updated, fetch its messages and look for messages where \`author_kind == "user"\` that you haven't processed yet.

IMPORTANT: The \`author_kind\` field values are \`"user"\` (human) or \`"agent"\`. There is no \`"human"\` value. Only process messages where \`author_kind == "user"\`.
`;
  }

  /* --- MCP section --- */
  prompt += `
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

  return prompt;
}

/* ------------------------------------------------------------------ */
/*  Radio group                                                        */
/* ------------------------------------------------------------------ */

function RadioGroup({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="accent-[var(--accent)]"
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function PromptBuilder({ apiKey, agentLabel, onConfigChange }: PromptBuilderProps) {
  const [answers, setAnswers] = useState<PromptAnswers>({
    hasWebhookUrl: null,
    canSearchData: null,
    includePolling: null,
    tools: new Set<string>(),
  });
  const [promptCopied, setPromptCopied] = useState(false);

  const pollingAutoSet = answers.hasWebhookUrl === "no";
  const effectivePolling = pollingAutoSet ? "yes" : answers.includePolling;

  const allAnswered =
    answers.hasWebhookUrl !== null &&
    answers.canSearchData !== null &&
    (pollingAutoSet || answers.includePolling !== null);

  useEffect(() => {
    onConfigChange?.({
      promptReady: allAnswered,
      hasWebhookUrl: answers.hasWebhookUrl === "yes",
    });
  }, [allAnswered, answers.hasWebhookUrl, onConfigChange]);

  const generatedPrompt = useMemo(
    () =>
      allAnswered
        ? buildDynamicPrompt(apiKey, agentLabel, {
            ...answers,
            includePolling: effectivePolling,
          })
        : "",
    [apiKey, agentLabel, answers, allAnswered, effectivePolling],
  );

  function toggleTool(tool: string) {
    setAnswers((prev) => {
      const next = new Set(prev.tools);
      if (next.has(tool)) {
        next.delete(tool);
      } else {
        next.add(tool);
      }
      return { ...prev, tools: next };
    });
  }

  async function handleCopyPrompt() {
    await navigator.clipboard.writeText(generatedPrompt);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
        Customize Your Agent Prompt
      </p>
      <p className="text-xs text-yellow-700 dark:text-yellow-300">
        Answer these questions to generate a setup prompt tailored to your
        agent&apos;s capabilities.
      </p>

      {/* Question 1 */}
      <div className="space-y-1.5 rounded-lg border border-[var(--border)] p-3">
        <div className="flex items-start">
          <p className="text-sm font-medium">
            Does your agent have a publicly reachable webhook URL?
          </p>
          <AskAgentTooltip promptKey="hasWebhookUrl" />
        </div>
        <RadioGroup
          name="hasWebhookUrl"
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
          value={answers.hasWebhookUrl}
          onChange={(v) =>
            setAnswers((prev) => ({
              ...prev,
              hasWebhookUrl: v as PromptAnswers["hasWebhookUrl"],
            }))
          }
        />
      </div>

      {/* Question 2 */}
      <div className="space-y-1.5 rounded-lg border border-[var(--border)] p-3">
        <div className="flex items-start">
          <p className="text-sm font-medium">
            Can your agent search emails, calendars, and SOPs?
          </p>
          <AskAgentTooltip promptKey="canSearchData" />
        </div>
        <RadioGroup
          name="canSearchData"
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
            { value: "not_sure", label: "Not sure" },
          ]}
          value={answers.canSearchData}
          onChange={(v) =>
            setAnswers((prev) => ({
              ...prev,
              canSearchData: v as PromptAnswers["canSearchData"],
            }))
          }
        />
      </div>

      {/* Question 3 — only shown when agent has a webhook URL */}
      {answers.hasWebhookUrl === "yes" && (
        <div className="space-y-1.5 rounded-lg border border-[var(--border)] p-3">
          <div className="flex items-start">
            <p className="text-sm font-medium">
              Include polling as a fallback to webhooks?
            </p>
            <AskAgentTooltip promptKey="includePolling" />
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            Uses more tokens but ensures your agent stays connected if webhooks
            go down.
          </p>
          <RadioGroup
            name="includePolling"
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
            value={answers.includePolling}
            onChange={(v) =>
              setAnswers((prev) => ({
                ...prev,
                includePolling: v as PromptAnswers["includePolling"],
              }))
            }
          />
        </div>
      )}
      {pollingAutoSet && (
        <div className="rounded-lg border border-[var(--border)] p-3">
          <p className="text-xs text-[var(--muted-foreground)]">
            Polling will be included automatically since your agent has no
            webhook URL.
          </p>
        </div>
      )}

      {/* Question 4 */}
      <div className="space-y-1.5 rounded-lg border border-[var(--border)] p-3">
        <div className="flex items-start">
          <p className="text-sm font-medium">
            What tools does your agent have access to?
          </p>
          <AskAgentTooltip promptKey="tools" />
        </div>
        <div className="flex flex-wrap gap-3">
          {TOOL_OPTIONS.map((tool) => (
            <label key={tool} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={answers.tools.has(tool)}
                onChange={() => toggleTool(tool)}
                className="accent-[var(--accent)]"
              />
              {tool}
            </label>
          ))}
        </div>
      </div>

      {/* Generated prompt */}
      {allAnswered && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
            Your Custom Agent Prompt
          </p>
          <p className="text-xs text-yellow-700 dark:text-yellow-300">
            Copy this and paste it into your AI agent&apos;s system prompt or
            configuration.
          </p>
          <div className="relative">
            <pre className="text-xs font-mono bg-white dark:bg-black/30 border border-[var(--border)] rounded p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
              {generatedPrompt}
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
      )}
    </div>
  );
}
