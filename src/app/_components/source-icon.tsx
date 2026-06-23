"use client";

import type { MessageAuthorKind, MessageMetadata } from "@/core/types";

const TEAL = "#14b8a6";

type SourceType = "browser" | "api" | "mcp";

export function resolveSourceType(
  authorKind: MessageAuthorKind,
  metadata: MessageMetadata | null,
): SourceType {
  if (metadata?.source === "api") return "api";
  if (metadata?.source === "browser") return "browser";
  // Future: metadata?.source === "mcp" → "mcp"
  return authorKind === "agent" ? "api" : "browser";
}

interface SourceIconProps {
  sourceType: SourceType;
  size?: number;
}

/** Small inline SVG favicon indicating how a message was delivered. */
export function SourceIcon({ sourceType, size = 14 }: SourceIconProps) {
  if (sourceType === "browser") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={TEAL}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label="Sent via browser"
        className="inline-block shrink-0"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    );
  }

  if (sourceType === "api") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={TEAL}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label="Sent via API"
        className="inline-block shrink-0"
      >
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="4" />
        <circle cx="9" cy="16" r="1" fill={TEAL} />
        <circle cx="15" cy="16" r="1" fill={TEAL} />
      </svg>
    );
  }

  // MCP / plug icon
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={TEAL}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Sent via MCP"
      className="inline-block shrink-0"
    >
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="M4.93 4.93l2.83 2.83" />
      <path d="M16.24 16.24l2.83 2.83" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="M4.93 19.07l2.83-2.83" />
      <path d="M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
