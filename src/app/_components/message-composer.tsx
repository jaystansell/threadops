"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FILE_LIMITS, isAllowedFile } from "@/core/types";
import { StickmanSendAnimation } from "./stickman-animations";

interface MessageComposerProps {
  threadId: string;
  userId: string;
}

interface PendingFile {
  file: File;
  preview?: string;
  progress: number;
  error?: string;
  uploaded?: boolean;
}

const MORE_CONTEXT_MESSAGE =
  "Please expand on this thread with more detail and context. Include relevant background, current status, key decisions or blockers, and any next steps.";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeIcon(contentType: string): string {
  if (contentType.startsWith("image/")) return "🖼️";
  if (contentType === "application/pdf") return "📄";
  if (contentType.startsWith("text/")) return "📝";
  if (contentType === "application/json") return "{ }";
  return "📎";
}

export function MessageComposer({ threadId, userId }: MessageComposerProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [requestingContext, setRequestingContext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showSendAnimation, setShowSendAnimation] = useState(false);

  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);

    setPendingFiles((prev) => {
      const remaining = FILE_LIMITS.MAX_FILES_PER_MESSAGE - prev.length;
      if (remaining <= 0) return prev;

      const newFiles = fileArray.slice(0, remaining).map((file) => {
        const validation = isAllowedFile(file.name, file.type || "application/octet-stream", file.size);
        const pending: PendingFile = {
          file,
          progress: 0,
          error: validation.ok ? undefined : validation.reason,
        };
        if (file.type.startsWith("image/") && validation.ok) {
          pending.preview = URL.createObjectURL(file);
        }
        return pending;
      });

      return [...prev, ...newFiles];
    });
  }, []);

  const removeFile = useCallback((index: number) => {
    setPendingFiles((prev) => {
      const removed = prev[index];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      const files: File[] = [];
      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        addFiles(files);
      }
    },
    [addFiles],
  );

  async function uploadFile(
    messageId: string,
    pending: PendingFile,
    index: number,
  ): Promise<boolean> {
    if (pending.error) return false;

    const formData = new FormData();
    formData.append("file", pending.file);

    try {
      setPendingFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, progress: 30 } : f)),
      );

      const res = await fetch(
        `/api/threads/${threadId}/messages/${messageId}/attachments`,
        { method: "POST", body: formData },
      );

      setPendingFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, progress: 90 } : f)),
      );

      if (!res.ok) {
        const data = await res.json();
        setPendingFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? { ...f, error: data.error || "Upload failed", progress: 0 }
              : f,
          ),
        );
        return false;
      }

      setPendingFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, progress: 100, uploaded: true } : f,
        ),
      );
      return true;
    } catch {
      setPendingFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, error: "Upload failed", progress: 0 } : f,
        ),
      );
      return false;
    }
  }

  async function sendMessage(messageBody: string) {
    const res = await fetch(`/api/threads/${threadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: messageBody, author_id: userId }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to send message");
    }

    return res.json();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && pendingFiles.length === 0) return;

    setSending(true);
    setError(null);

    try {
      const message = await sendMessage(body.trim() || "(attachment)");

      // Upload any pending files
      let uploadFailed = false;
      const validFiles = pendingFiles.filter((f) => !f.error);
      if (validFiles.length > 0) {
        const results = await Promise.all(
          pendingFiles.map((f, i) => {
            if (f.error) return Promise.resolve(false);
            return uploadFile(message.id, f, i);
          }),
        );
        const failedCount = results.filter((r) => r === false).length;
        if (failedCount > 0) {
          uploadFailed = true;
          setError(`${failedCount} file(s) failed to upload`);
        }
      }

      setBody("");
      setPendingFiles((prev) => {
        prev.forEach((f) => { if (f.preview) URL.revokeObjectURL(f.preview); });
        return [];
      });
      if (!uploadFailed) setShowSendAnimation(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  async function handleRequestContext() {
    setRequestingContext(true);
    setError(null);

    try {
      await sendMessage(MORE_CONTEXT_MESSAGE);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRequestingContext(false);
    }
  }

  const isBusy = sending || requestingContext;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-2"
      data-testid="message-composer"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className={`relative rounded-lg border transition-colors ${
          isDragOver
            ? "border-[var(--primary)] bg-[var(--primary)]/5"
            : "border-[var(--border)]"
        }`}
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          onPaste={handlePaste}
          placeholder="Type your message... (⌘/Ctrl+Enter to send)"
          rows={3}
          data-testid="message-input"
          className="w-full rounded-lg bg-[var(--background)] px-3 py-2 text-[16px] sm:text-sm focus:outline-none resize-none border-none"
          disabled={isBusy}
        />
        {isDragOver && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-[var(--primary)]/10 pointer-events-none">
            <span className="text-sm font-medium text-[var(--primary)]">
              Drop files here
            </span>
          </div>
        )}
      </div>

      {/* File previews */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="file-previews">
          {pendingFiles.map((pf, i) => (
            <div
              key={`${pf.file.name}-${i}`}
              className={`relative flex items-center gap-2 px-2 py-1.5 rounded-md border text-xs ${
                pf.error
                  ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                  : pf.uploaded
                    ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                    : "border-[var(--border)] bg-[var(--muted)]"
              }`}
            >
              {pf.preview ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={pf.preview}
                  alt={pf.file.name}
                  className="w-8 h-8 object-cover rounded"
                />
              ) : (
                <span className="text-base">{fileTypeIcon(pf.file.type)}</span>
              )}
              <div className="flex flex-col min-w-0">
                <span className="truncate max-w-[120px]">{pf.file.name}</span>
                <span className="text-[10px] text-[var(--muted-foreground)]">
                  {formatFileSize(pf.file.size)}
                </span>
                {pf.error && (
                  <span className="text-[10px] text-red-500">{pf.error}</span>
                )}
              </div>
              {pf.progress > 0 && pf.progress < 100 && (
                <div className="absolute bottom-0 left-0 h-0.5 bg-[var(--primary)] rounded-full transition-all" style={{ width: `${pf.progress}%` }} />
              )}
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="ml-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                aria-label={`Remove ${pf.file.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            type="submit"
            disabled={isBusy || (!body.trim() && pendingFiles.filter((f) => !f.error).length === 0)}
            data-testid="message-send"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {sending ? "Sending..." : "Send Message"}
          </button>
          {showSendAnimation && (
            <StickmanSendAnimation onComplete={() => setShowSendAnimation(false)} />
          )}
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy || pendingFiles.length >= FILE_LIMITS.MAX_FILES_PER_MESSAGE}
          className="px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-50 transition-colors"
          data-testid="attach-file"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="inline-block mr-1"
          >
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
          Attach
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
          accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,text/csv,text/markdown,application/json"
        />
        <button
          type="button"
          onClick={handleRequestContext}
          disabled={isBusy}
          data-testid="request-context"
          className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-50 transition-colors"
        >
          {requestingContext ? "Requesting..." : "Ask for More Context"}
        </button>
      </div>
      {pendingFiles.length > 0 && (
        <p className="text-[10px] text-[var(--muted-foreground)]">
          {pendingFiles.filter((f) => !f.error).length}/{FILE_LIMITS.MAX_FILES_PER_MESSAGE} files
          · Max {FILE_LIMITS.MAX_FILE_SIZE / 1024 / 1024} MB each
        </p>
      )}
    </form>
  );
}
