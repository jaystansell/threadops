"use client";

import { useState } from "react";
import type { ApiKey } from "@/core/types";
import { RevokeApiKeyButton } from "./revoke-api-key-button";
import { FormattedDate } from "./formatted-date";

interface Props {
  keys: ApiKey[];
  companyId: string;
  skillsMap?: Record<string, string[]>;
}

export function ApiKeyList({ keys, companyId, skillsMap = {} }: Props) {
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
              {!key.revoked_at && (!skillsMap[key.id] || skillsMap[key.id].length === 0) && (
                <p className="text-[10px] text-[var(--muted-foreground)] mt-2 italic">
                  No skills reported yet
                </p>
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
