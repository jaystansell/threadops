"use client";

import { useState } from "react";
import { VALID_SCOPES } from "./api-key-scopes";

interface Props {
  companyId: string;
}

interface CreateResult {
  id: string;
  plaintext_key: string;
  key_prefix: string;
  message: string;
}

export function CreateApiKeyForm({ companyId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [copied, setCopied] = useState(false);

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

  function handleDismiss() {
    setResult(null);
    setIsOpen(false);
    window.location.reload();
  }

  if (result) {
    return (
      <div className="rounded-lg border-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-4 space-y-3">
        <p className="font-semibold text-yellow-800 dark:text-yellow-200">
          API Key Created — Copy it now!
        </p>
        <p className="text-xs text-yellow-700 dark:text-yellow-300">
          This key will not be shown again. Store it securely.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-sm font-mono bg-white dark:bg-black/30 border border-[var(--border)] rounded px-3 py-2 break-all">
            {result.plaintext_key}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity shrink-0"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
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
        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
      >
        Create API Key
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-[var(--border)] p-4 space-y-4"
    >
      <div>
        <label
          htmlFor="api-key-label"
          className="block text-sm font-medium mb-1"
        >
          Label
        </label>
        <input
          id="api-key-label"
          type="text"
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Production webhook sender"
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
