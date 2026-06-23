"use client";

import { useState, useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "threadops-trusted-domains";

function getTrustedDomains(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function addTrustedDomain(domain: string) {
  try {
    const current = getTrustedDomains();
    current.add(domain);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current]));
  } catch {
    // Silently handle
  }
}

function isInternalUrl(href: string): boolean {
  try {
    const url = new URL(href, window.location.origin);
    const hostname = url.hostname;
    if (url.origin === window.location.origin) return true;
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    if (hostname === "threadops-jade.vercel.app") return true;
    return false;
  } catch {
    return true;
  }
}

function extractDomain(href: string): string {
  try {
    return new URL(href).hostname;
  } catch {
    return href;
  }
}

interface ExternalLinkModalProps {
  href: string;
  onClose: () => void;
}

export function ExternalLinkModal({ href, onClose }: ExternalLinkModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const domain = extractDomain(href);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleContinue = useCallback(() => {
    if (dontShowAgain) {
      addTrustedDomain(domain);
    }
    window.open(href, "_blank", "noopener,noreferrer");
    onClose();
  }, [href, domain, dontShowAgain, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-xl max-w-md w-full mx-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="external-link-modal-title"
      >
        <div className="p-4 border-b border-[var(--border)] flex items-center gap-2">
          <svg
            className="w-5 h-5 text-amber-500 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M10.29 3.86l-8.03 14A2 2 0 004.03 21h15.94a2 2 0 001.77-3.14l-8.03-14a2 2 0 00-3.42 0z"
            />
          </svg>
          <h3
            id="external-link-modal-title"
            className="text-sm font-semibold"
          >
            External Link
          </h3>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-[var(--muted-foreground)]">
            You are about to leave Threadzy and visit an external site.
          </p>

          <div className="rounded border border-[var(--border)] bg-[var(--muted)] px-3 py-2">
            <p className="text-xs text-[var(--muted-foreground)] mb-1">
              Domain
            </p>
            <p className="text-sm font-semibold break-all">{domain}</p>
          </div>

          <div className="rounded border border-[var(--border)] bg-[var(--muted)] px-3 py-2">
            <p className="text-xs text-[var(--muted-foreground)] mb-1">
              Full URL
            </p>
            <p className="text-xs text-[var(--foreground)] break-all font-mono">
              {href}
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
            />
            <span className="text-xs text-[var(--muted-foreground)]">
              Don&apos;t show again for {domain}
            </span>
          </label>
        </div>

        <div className="p-4 border-t border-[var(--border)] flex gap-2">
          <button
            type="button"
            onClick={handleContinue}
            className="flex-1 px-3 py-1.5 text-sm font-medium rounded bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export { isInternalUrl, getTrustedDomains, extractDomain };
