"use client";

import { useState } from "react";

interface ApiKeyOption {
  id: string;
  label: string;
  key_prefix: string;
  scopes: string[];
}

interface Props {
  apiKeys: ApiKeyOption[];
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  companyId: string;
}

export function AuthorizeForm({
  apiKeys,
  clientId,
  redirectUri,
  scope,
  state,
  codeChallenge,
  codeChallengeMethod,
}: Props) {
  const [selectedKeyId, setSelectedKeyId] = useState(
    apiKeys.length === 1 ? apiKeys[0].id : "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAuthorize() {
    if (!selectedKeyId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          scope,
          state,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
          api_key_id: selectedKeyId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Authorization failed");
      }

      const data = await res.json();
      window.location.href = data.redirect_uri;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  }

  function handleDeny() {
    const url = new URL(redirectUri);
    url.searchParams.set("error", "access_denied");
    url.searchParams.set(
      "error_description",
      "The user denied the authorization request",
    );
    if (state) url.searchParams.set("state", state);
    window.location.href = url.toString();
  }

  if (apiKeys.length === 0) {
    return (
      <div className="rounded-lg border border-yellow-700/40 bg-yellow-900/20 p-4 space-y-3">
        <p className="text-sm text-yellow-200">
          You don&apos;t have any API keys yet.
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          Create an API key in your{" "}
          <a
            href="/api-keys"
            className="text-[var(--accent)] hover:underline"
          >
            API Keys settings
          </a>
          , then return here to authorize this application.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">Select an API key to authorize:</p>
        <div className="space-y-2">
          {apiKeys.map((key) => (
            <label
              key={key.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedKeyId === key.id
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)] hover:border-[var(--primary)]"
              }`}
            >
              <input
                type="radio"
                name="api_key"
                value={key.id}
                checked={selectedKeyId === key.id}
                onChange={() => setSelectedKeyId(key.id)}
                className="shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{key.label}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {key.key_prefix}... &middot;{" "}
                  {key.scopes.length} scope{key.scopes.length !== 1 ? "s" : ""}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleAuthorize}
          disabled={loading || !selectedKeyId}
          className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? "Authorizing..." : "Authorize"}
        </button>
        <button
          type="button"
          onClick={handleDeny}
          disabled={loading}
          className="px-4 py-2.5 text-sm font-medium rounded-lg border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
        >
          Deny
        </button>
      </div>

      <p className="text-xs text-[var(--muted-foreground)] text-center">
        Authorizing gives{" "}
        <span className="font-medium text-[var(--foreground)]">{clientId}</span>{" "}
        access to your Threadzy data using the selected API key.
      </p>
    </div>
  );
}
