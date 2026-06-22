"use client";

import { useState } from "react";
import type { ApiKey } from "@/core/types";
import { RevokeApiKeyButton } from "./revoke-api-key-button";
import { FormattedDate } from "./formatted-date";

interface Props {
  keys: ApiKey[];
  companyId: string;
  skillsMap?: Record<string, string[]>;
  webhookStatusMap?: Record<string, boolean>;
}

export function ApiKeyList({ keys, companyId, skillsMap = {}, webhookStatusMap = {} }: Props) {
  const [showRevoked, setShowRevoked] = useState(false);

  const activeKeys = keys.filter((k) => !k.revoked_at);
  const revokedKeys = keys.filter((k) => k.revoked_at);

  const displayedKeys = showRevoked ? revokedKeys : activeKeys;
  const emptyMessage = showRevoked
    ? "No revoked keys."
    : "No active keys. Create one above.";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-0.5 w-fit">
        <button
          type="button"
          onClick={() => setShowRevoked(false)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            !showRevoked
              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          Active ({activeKeys.length})
        </button>
        <button
          type="button"
          onClick={() => setShowRevoked(true)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            showRevoked
              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          Revoked ({revokedKeys.length})
        </button>
      </div>

      {displayedKeys.length === 0 ? (
        <p className="text-[var(--muted-foreground)] text-sm">
          {emptyMessage}
        </p>
      ) : (
        <ul className="space-y-2">
          {displayedKeys.map((key) => (
            <li
              key={key.id}
              className={`rounded-lg border border-[var(--border)] p-4 ${
                key.revoked_at ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{key.label}</span>
                    {key.revoked_at && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                        Revoked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Posts as: <span className="font-medium">{key.label}</span>
                  </p>
                  <p className="text-sm font-mono text-[var(--muted-foreground)]">
                    {key.key_prefix}...
                  </p>
                </div>
                {!key.revoked_at && (
                  <RevokeApiKeyButton
                    companyId={companyId}
                    keyId={key.id}
                  />
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {key.scopes.map((scope) => (
                  <span
                    key={scope}
                    className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]"
                  >
                    {scope}
                  </span>
                ))}
              </div>

              {/* Setup checklist for active keys */}
              {!key.revoked_at && (() => {
                const hasWebhook = webhookStatusMap[key.id] ?? false;
                const hasSkills = (skillsMap[key.id] ?? []).length > 0;
                const allComplete = hasWebhook && hasSkills;
                return (
                  <div className={`mt-3 rounded-lg border p-3 space-y-2 ${
                    allComplete
                      ? "border-emerald-700/40 bg-emerald-900/20"
                      : "border-amber-700/40 bg-amber-900/20"
                  }`}>
                    <p className={`text-[10px] uppercase tracking-wider font-semibold ${
                      allComplete ? "text-emerald-400" : "text-amber-400"
                    }`}>
                      {allComplete ? "Setup complete" : "Setup checklist"}
                    </p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {hasWebhook ? (
                          <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        )}
                        <span className={`text-xs ${hasWebhook ? "text-emerald-300" : "text-amber-300 font-medium"}`}>
                          {hasWebhook ? "Webhook registered" : "No webhook — agent is deaf to replies"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasSkills ? (
                          <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <circle cx="12" cy="12" r="10" />
                          </svg>
                        )}
                        <span className={`text-xs ${hasSkills ? "text-emerald-300" : "text-[var(--muted-foreground)]"}`}>
                          {hasSkills ? `${skillsMap[key.id].length} skill(s) reported` : "No skills reported yet"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {!key.revoked_at && skillsMap[key.id] && skillsMap[key.id].length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
                    Skills
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {skillsMap[key.id].map((skill) => (
                      <span
                        key={skill}
                        className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-[var(--muted-foreground)] mt-2">
                Created <FormattedDate date={key.created_at} />
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
