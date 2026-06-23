"use client";

import { useState } from "react";
import type { MessageMetadata } from "@/core/types";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="ml-auto p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}

function DetailSection({
  label,
  children,
  copyText,
}: {
  label: string;
  children: React.ReactNode;
  copyText?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50 transition-colors"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={`transition-transform ${open ? "rotate-90" : ""}`}
        >
          <path d="M8 5l8 7-8 7z" />
        </svg>
        {label}
        {copyText && <CopyButton text={copyText} />}
      </button>
      {open && (
        <div className="px-3 py-2 border-t border-[var(--border)] bg-[var(--background)] font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
          {children}
        </div>
      )}
    </div>
  );
}

interface MessageDetailsPanelProps {
  metadata: MessageMetadata;
  messageId: string;
  messageCreatedAt: string;
}

export function MessageDetailsPanel({
  metadata,
  messageId,
  messageCreatedAt,
}: MessageDetailsPanelProps) {
  const argumentLines: string[] = [];
  if (metadata.api_key_prefix) {
    argumentLines.push(`API_KEY="${metadata.api_key_prefix}${"*".repeat(8)}..."`);
  }
  argumentLines.push(`endpoint: ${metadata.endpoint}`);
  argumentLines.push(`thread_id: ${metadata.thread_id}`);
  if (metadata.agent_label) {
    argumentLines.push(`agent: ${metadata.agent_label}`);
  }
  argumentLines.push(`source: ${metadata.source}`);

  const argumentsText = argumentLines.join("\n");

  const resultObj = {
    id: messageId,
    author_name: metadata.agent_label ?? null,
    created_at: messageCreatedAt,
    source: metadata.source,
  };
  const resultText = JSON.stringify(resultObj, null, 2);

  return (
    <div className="mt-2 space-y-1.5">
      <DetailSection label="Arguments:" copyText={argumentsText}>
        {argumentLines.map((line, i) => (
          <div key={i}>
            <span className="text-[var(--muted-foreground)]">  </span>
            {line}
          </div>
        ))}
      </DetailSection>
      <DetailSection label="Result:" copyText={resultText}>
        <span className="text-[var(--muted-foreground)]">{"log: "}</span>
        {"(nested JSON)"}
        {"\n"}
        <span className="text-[var(--muted-foreground)]">{"  id: "}</span>
        {messageId}
        {"\n"}
        <span className="text-[var(--muted-foreground)]">{"  author_name: "}</span>
        {metadata.agent_label ?? "null"}
        {"\n"}
        <span className="text-[var(--muted-foreground)]">{"  created_at: "}</span>
        {messageCreatedAt}
      </DetailSection>
    </div>
  );
}
