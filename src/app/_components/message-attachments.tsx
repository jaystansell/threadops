"use client";

import { useEffect, useState, useCallback } from "react";
import type { Attachment } from "@/core/types";

const INLINE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
]);

function isImage(contentType: string): boolean {
  return contentType.startsWith("image/");
}

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

function ImagePreview({
  threadId,
  messageId,
  attachment,
}: {
  threadId: string;
  messageId: string;
  attachment: Attachment;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (attachment.purged_at) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/threads/${threadId}/messages/${messageId}/attachments/${attachment.id}/download`,
        );
        if (cancelled) return;
        if (!res.ok) {
          setError(true);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!cancelled && data.url) {
          setUrl(data.url);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [threadId, messageId, attachment.id, attachment.purged_at]);

  if (attachment.purged_at) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4 text-center">
        <span className="text-xs text-red-500">Image expired</span>
        <div className="text-[10px] text-[var(--muted-foreground)] mt-1">{attachment.filename}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] animate-pulse w-full max-w-xs h-40 flex items-center justify-center">
        <span className="text-[10px] text-[var(--muted-foreground)]">Loading preview...</span>
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4 text-center">
        <span className="text-xs text-[var(--muted-foreground)]">Preview unavailable</span>
        <div className="text-[10px] text-[var(--muted-foreground)] mt-1">{attachment.filename}</div>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-[var(--border)] overflow-hidden hover:border-[var(--primary)] transition-colors group"
      title={`Open ${attachment.filename} (${formatFileSize(attachment.file_size)})`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={attachment.filename}
        className="max-w-xs max-h-60 object-contain bg-black/20"
        loading="lazy"
      />
      <div className="px-2 py-1 flex items-center gap-2 bg-[var(--background)] text-[10px] text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors">
        <span className="truncate">{attachment.filename}</span>
        <span className="flex-shrink-0">{formatFileSize(attachment.file_size)}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="flex-shrink-0 ml-auto"
        >
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </div>
    </a>
  );
}

function FileChip({
  threadId,
  messageId,
  attachment,
}: {
  threadId: string;
  messageId: string;
  attachment: Attachment;
}) {
  const handleClick = useCallback(async () => {
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
      // Silently handle errors
    }
  }, [threadId, messageId, attachment.id]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!!attachment.purged_at}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs transition-colors ${
        attachment.purged_at
          ? "border-[var(--border)] bg-[var(--muted)] opacity-50 cursor-not-allowed"
          : "border-[var(--border)] bg-[var(--background)] hover:bg-[var(--muted)] hover:border-[var(--primary)] cursor-pointer"
      }`}
      title={attachment.purged_at ? "File purged" : `Open ${attachment.filename}`}
    >
      <span className="text-[var(--muted-foreground)]">
        {fileIcon(attachment.content_type)}
      </span>
      <span className="truncate max-w-[140px]">{attachment.filename}</span>
      <span className="text-[10px] text-[var(--muted-foreground)]">
        {formatFileSize(attachment.file_size)}
      </span>
      {attachment.purged_at ? (
        <span className="text-[10px] text-red-500">expired</span>
      ) : INLINE_TYPES.has(attachment.content_type) ? (
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
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
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
  );
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

  const imageAttachments = attachments.filter((a) => isImage(a.content_type));
  const fileAttachments = attachments.filter((a) => !isImage(a.content_type));

  return (
    <div className="mt-2 space-y-2" data-testid="message-attachments">
      {imageAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {imageAttachments.map((att) => (
            <ImagePreview
              key={att.id}
              threadId={threadId}
              messageId={messageId}
              attachment={att}
            />
          ))}
        </div>
      )}
      {fileAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fileAttachments.map((att) => (
            <FileChip
              key={att.id}
              threadId={threadId}
              messageId={messageId}
              attachment={att}
            />
          ))}
        </div>
      )}
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
