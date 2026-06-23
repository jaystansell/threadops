"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { VALID_SCOPES } from "@/core/rules/api-key";
import { PromptBuilder } from "./prompt-builder";
import type { PromptBuilderConfig } from "./prompt-builder";

interface Props {
  companyId: string;
}

interface CreateResult {
  id: string;
  plaintext_key: string;
  key_prefix: string;
  message: string;
}

type SetupPhase = "created" | "shared" | "monitoring" | "success" | "needs-manual-webhook";

export function CreateApiKeyForm({ companyId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([...VALID_SCOPES]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [createdLabel, setCreatedLabel] = useState("");
  const [promptConfig, setPromptConfig] = useState<PromptBuilderConfig>({
    promptReady: false,
    hasWebhookUrl: false,
  });
  const [setupPhase, setSetupPhase] = useState<SetupPhase>("created");
  const [pollSeconds, setPollSeconds] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const POLL_DURATION = 300; // 5 minutes

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

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
      setSelectedScopes([...VALID_SCOPES]);
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

        <PromptBuilder
          apiKey={result.plaintext_key}
          agentLabel={createdLabel}
          onConfigChange={setPromptConfig}
        />

        {setupPhase === "created" && (
          <div className="space-y-3 border-t border-[var(--border)] pt-4">
            {!promptConfig.promptReady ? (
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                <strong>Next:</strong> Answer the questions above to generate your agent&apos;s setup prompt.
              </p>
            ) : (
              <>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  <strong>Next:</strong> Copy the prompt above and share it with your agent.
                  {promptConfig.hasWebhookUrl && (
                    <> Some agents (like Tasklet) need you to manually provide the webhook URL — they can&apos;t see it themselves.</>
                  )}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  For a complete machine-readable API spec, fetch{" "}
                  <code className="bg-[var(--muted)] px-1 py-0.5 rounded text-[10px]">GET /api/openapi.json</code>
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    setSetupPhase("shared");
                    // Mark as shared in backend (best-effort, column may not exist yet)
                    try {
                      await fetch(`/api/companies/${companyId}/api-keys/${result.id}/shared`, {
                        method: "POST",
                      });
                    } catch { /* migration may not be run yet */ }

                    if (promptConfig.hasWebhookUrl) {
                      // Start monitoring for webhook registration
                      setSetupPhase("monitoring");
                      setPollSeconds(0);
                      timerRef.current = setInterval(() => {
                        setPollSeconds((s) => s + 1);
                      }, 1000);
                      pollRef.current = setInterval(async () => {
                        try {
                          const res = await fetch(`/api/companies/${companyId}/api-keys/${result.id}/setup-status`);
                          if (res.ok) {
                            const data = await res.json();
                            if (data.has_webhook) {
                              stopPolling();
                              setSetupPhase("success");
                            }
                          }
                        } catch { /* ignore */ }
                      }, 10000);
                      setTimeout(() => {
                        stopPolling();
                        setSetupPhase((prev) => prev === "monitoring" ? "needs-manual-webhook" : prev);
                      }, POLL_DURATION * 1000);
                    } else {
                      // Polling-only setup — skip webhook monitoring
                      setSetupPhase("success");
                    }
                  }}
                  className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
                >
                  I&apos;ve shared this with my agent
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleDismiss}
              className="text-sm text-[var(--muted-foreground)] hover:underline"
            >
              Skip for now
            </button>
          </div>
        )}

        {setupPhase === "monitoring" && (
          <div className="space-y-3 border-t border-[var(--border)] pt-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Waiting for {createdLabel} to register a webhook...
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {Math.floor((POLL_DURATION - pollSeconds) / 60)}:{String((POLL_DURATION - pollSeconds) % 60).padStart(2, "0")} remaining
                </p>
              </div>
            </div>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              Tip: Some agents can&apos;t discover their own webhook URL automatically.
              If your agent asks for a webhook URL, you&apos;ll need to provide it from your agent platform (e.g. Tasklet trigger card).
            </p>
            <button
              type="button"
              onClick={() => { stopPolling(); setSetupPhase("needs-manual-webhook"); }}
              className="text-xs text-[var(--muted-foreground)] hover:underline"
            >
              My agent needs help with webhooks
            </button>
          </div>
        )}

        {setupPhase === "success" && (
          <div className="space-y-3 border-t border-emerald-700/40 pt-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm font-medium text-emerald-300">
                {createdLabel} registered a webhook! Setup complete.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        )}

        {setupPhase === "needs-manual-webhook" && (
          <div className="space-y-3 border-t border-amber-700/40 pt-4">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-300">
                  {createdLabel} hasn&apos;t registered a webhook yet
                </p>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Many agents can&apos;t see their own webhook URL. You may need to:
                </p>
              </div>
            </div>
            <ol className="text-xs text-[var(--muted-foreground)] space-y-1.5 ml-7 list-decimal">
              <li>Find the webhook/trigger URL in your agent platform (e.g. Tasklet &quot;ThreadOps reply notifications&quot; trigger card)</li>
              <li>Copy the URL (looks like <code className="text-[var(--foreground)]">https://webhooks.example.com/v1/...</code>)</li>
              <li>Give it to your agent, or register it manually with this curl command:</li>
            </ol>
            <pre className="text-xs font-mono bg-[var(--muted)] rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">
{`curl -X POST "${typeof window !== "undefined" ? window.location.origin : ""}/api/webhook-endpoints" \\
  -H "X-API-Key: ${result.plaintext_key}" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"PASTE_WEBHOOK_URL_HERE","events":["message.created","thread.created","thread.status_changed","action.requested"]}'`}
            </pre>
            <p className="text-xs text-amber-400">
              We&apos;ll show a reminder on the API Keys page until this agent has a webhook.
            </p>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        )}
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
        <label className="flex items-center gap-1.5 text-sm mb-2 text-[var(--accent)] font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={selectedScopes.length === VALID_SCOPES.length}
            onChange={() =>
              setSelectedScopes(
                selectedScopes.length === VALID_SCOPES.length ? [] : [...VALID_SCOPES],
              )
            }
          />
          Select all
        </label>
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
          disabled={loading || !label || selectedScopes.length === 0}
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
