"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface SavedPrompt {
  id: string;
  title: string;
  body: string;
  agent_scope: { all: true } | { api_key_ids: string[] };
}

interface PromptPickerProps {
  apiKeyId: string | null;
}

export function PromptPicker({ apiKeyId }: PromptPickerProps) {
  const [open, setOpen] = useState(false);
  const [prompts, setPrompts] = useState<SavedPrompt[] | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);

  const fetchPrompts = useCallback(async () => {
    try {
      const res = await fetch("/api/saved-prompts");
      if (!res.ok) return;
      const all: SavedPrompt[] = await res.json();
      const filtered = all.filter((p) => {
        if ("all" in p.agent_scope && p.agent_scope.all) return true;
        if ("api_key_ids" in p.agent_scope && apiKeyId) {
          return p.agent_scope.api_key_ids.includes(apiKeyId);
        }
        return false;
      });
      setPrompts(filtered);
    } catch {
      setPrompts([]);
    }
  }, [apiKeyId]);

  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next && !fetchedRef.current) {
        fetchedRef.current = true;
        fetchPrompts();
      }
      return next;
    });
  }, [fetchPrompts]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  const handleCopy = useCallback(
    async (prompt: SavedPrompt) => {
      try {
        await navigator.clipboard.writeText(prompt.body);
        setCopiedId(prompt.id);
        setTimeout(() => {
          setCopiedId((prev) => (prev === prompt.id ? null : prev));
        }, 2000);
      } catch {
        // Fallback: noop
      }
    },
    [],
  );

  return (
    <div className="relative inline-block" ref={panelRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--primary)] transition-colors"
        aria-label="Use a saved prompt"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        Prompts
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 z-30 w-72 max-h-60 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg">
          {prompts === null ? (
            <div className="px-3 py-4 text-xs text-[var(--muted-foreground)] text-center">
              Loading...
            </div>
          ) : prompts.length === 0 ? (
            <div className="px-3 py-4 text-xs text-[var(--muted-foreground)] text-center">
              No prompts match this agent.
            </div>
          ) : (
            prompts.map((prompt) => (
              <button
                key={prompt.id}
                type="button"
                onClick={() => handleCopy(prompt)}
                className="w-full text-left px-3 py-2 hover:bg-[var(--muted)] transition-colors border-b border-[var(--border)] last:border-b-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium truncate">
                    {prompt.title}
                  </span>
                  {copiedId === prompt.id && (
                    <span className="text-[10px] text-[var(--accent)] shrink-0">
                      Copied!
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--muted-foreground)] truncate mt-0.5">
                  {prompt.body.slice(0, 100)}
                  {prompt.body.length > 100 ? "..." : ""}
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
