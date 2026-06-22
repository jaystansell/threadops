"use client";

import { useState, useEffect, useRef } from "react";

const POLL_INTERVAL = 60_000; // 60 seconds

export function UpdateToast() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const initialVersionRef = useRef<string | null>(null);

  useEffect(() => {
    async function checkVersion() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { version: string };

        if (initialVersionRef.current === null) {
          initialVersionRef.current = data.version;
          return;
        }

        if (data.version !== initialVersionRef.current) {
          setUpdateAvailable(true);
        }
      } catch {
        // Network error — skip this cycle
      }
    }

    checkVersion();
    const timer = setInterval(checkVersion, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
      <div className="flex items-center gap-3 bg-[var(--background)] border border-[var(--accent)] rounded-lg shadow-lg shadow-teal-500/10 px-4 py-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-5 h-5 text-[var(--accent)] shrink-0"
        >
          <path
            fillRule="evenodd"
            d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.033l.312.311a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm-9.624-2.849a5.5 5.5 0 019.201-2.466l.312.311H12.768a.75.75 0 000 1.5h3.634a.75.75 0 00.75-.75V3.536a.75.75 0 00-1.5 0v2.033l-.312-.312A7 7 0 003.628 8.396a.75.75 0 001.449.389z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-sm text-[var(--foreground)]">
          A new version of Threadzy is available
        </span>
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1 text-xs font-medium rounded bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
        >
          Refresh
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors ml-1"
          aria-label="Dismiss"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
