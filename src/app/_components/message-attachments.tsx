"use client";

import { useEffect, useState } from "react";
import type { Attachment } from "@/core/types";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(contentType: string) {
  if (contentType.startsWith("image/")) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    );
  }
  if (contentType === "application/pdf") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

interface MessageAttachmentsProps {
  threadId: string;
  messageId: string;
  attachmentCount?: number;
}

export function MessageAttachments({
  threadId,
  messageId,
  attachmentCount = 0,
}: MessageAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    if (attachmentCount === 0 || status !== "idle") return;

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(
          `/api/threads/${threadId}/messages/${messageId}/attachments`,
          { signal: controller.signal },
        );
        if (cancelled) return;
        const data: Attachment[] = res.ok ? await res.json() : [];
        if (!cancelled) {
          setAttachments(data);
          setStatus("done");
        }
      } catch {
        if (!cancelled) setStatus("done");
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [threadId, messageId, attachmentCount, status]);

  if (attachmentCount === 0 && attachments.length === 0) return null;

  if (status === "loading" || (status === "idle" && attachmentCount > 0)) {
    return (
      <div className="mt-2 text-xs text-[var(--muted-foreground)]">
        Loading attachments...
      </div>
    );
  }

  async function handleDownload(attachment: Attachment) {
    try {
      const res = await fetch(
        `/api/threads/${threadId}/messages/${messageId}/attachments/${attachment.id}/download`,
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } catch {
      // Silently handle download errors
    }
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2" data-testid="message-attachments">
      {attachments.map((att) => (
        <button
          key={att.id}
          type="button"
          onClick={() => handleDownload(att)}
          disabled={!!att.purged_at}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs transition-colors ${
            att.purged_at
              ? "border-[var(--border)] bg-[var(--muted)] opacity-50 cursor-not-allowed"
              : "border-[var(--border)] bg-[var(--background)] hover:bg-[var(--muted)] hover:border-[var(--primary)] cursor-pointer"
          }`}
          title={att.purged_at ? "File purged" : `Download ${att.filename}`}
        >
          <span className="text-[var(--muted-foreground)]">
            {fileIcon(att.content_type)}
          </span>
          <span className="truncate max-w-[140px]">{att.filename}</span>
          <span className="text-[10px] text-[var(--muted-foreground)]">
            {formatFileSize(att.file_size)}
          </span>
          {att.purged_at ? (
            <span className="text-[10px] text-red-500">expired</span>
          ) : (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[var(--muted-foreground)]"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}

export function AttachmentBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]"
      title={`${count} attachment${count !== 1 ? "s" : ""}`}
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
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
      </svg>
      {count}
    </span>
  );
}
