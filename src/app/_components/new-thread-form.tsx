"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FILE_LIMITS, isAllowedFile } from "@/core/types";
import { PromptPicker } from "./prompt-picker";

interface Agent {
  id: string;
  label: string;
}

interface NewThreadFormProps {
  companyId: string;
  agents?: Agent[];
}

interface PendingFile {
  file: File;
  preview?: string;
  progress: number;
  error?: string;
  uploaded?: boolean;
}

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

export function NewThreadForm({ companyId, agents = [] }: NewThreadFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

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
    threadId: string,
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

  async function markMessageReady(threadId: string, messageId: string, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await fetch(
          `/api/threads/${threadId}/messages/${messageId}/ready`,
          { method: "POST" },
        );
        if (res.ok) return res.json();
        if (attempt === retries) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to finalize message delivery");
        }
      } catch (err) {
        if (attempt === retries) throw err;
      }
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || (!messageBody.trim() && pendingFiles.length === 0) || !selectedAgent) return;

    setSubmitting(true);
    setError(null);

    try {
      const validFiles = pendingFiles.filter((f) => !f.error);
      const hasAttachments = validFiles.length > 0;

      const res = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          company_id: companyId,
          message_body: (messageBody.trim() || "(attachment)"),
          agent_api_key_id: selectedAgent,
          has_pending_attachments: hasAttachments,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create thread");
      }

      const thread = await res.json();

      // Add tags if any
      if (tags.length > 0) {
        await fetch(`/api/threads/${thread.id}/tags`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags }),
        });
      }

      // Upload attachments and signal ready
      if (hasAttachments && thread.message_id) {
        const results = await Promise.all(
          pendingFiles.map((f, i) => {
            if (f.error) return Promise.resolve(false);
            return uploadFile(thread.id, thread.message_id, f, i);
          }),
        );
        const failedCount = results.filter((r) => r === false).length;
        if (failedCount > 0) {
          setError(`${failedCount} file(s) failed to upload`);
        }

        try {
          await markMessageReady(thread.id, thread.message_id);
        } catch {
          setError(
            "Thread created but agent notification failed. The agent may not see attached files.",
          );
        }
      }

      router.push(`/threads/${thread.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      data-testid="new-thread-form"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium mb-1"
        >
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Thread title"
          required
          data-testid="thread-title-input"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[16px] sm:text-sm focus:outline-none focus:border-[var(--primary)]"
          disabled={submitting}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Agent <span className="text-red-500">*</span>
        </label>
        {agents.length > 0 ? (
          <div className="flex flex-wrap gap-2" data-testid="thread-agent-select">
            {agents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => setSelectedAgent(agent.id)}
                disabled={submitting}
                data-testid={`agent-option-${agent.id}`}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  selectedAgent === agent.id
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--background)] hover:border-[var(--accent)]/50"
                }`}
              >
                {agent.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">
            No active agents. Create an API key first.
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="message"
          className="block text-sm font-medium mb-1"
        >
          Message {pendingFiles.length === 0 && <span className="text-red-500">*</span>}
        </label>
        <div
          className={`relative rounded-lg border transition-colors ${
            isDragOver
              ? "border-[var(--primary)] bg-[var(--primary)]/5"
              : "border-[var(--border)]"
          }`}
        >
          <textarea
            id="message"
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            onPaste={handlePaste}
            placeholder="Write the first message..."
            rows={5}
            required={pendingFiles.filter((f) => !f.error).length === 0}
            data-testid="thread-message-input"
            className="w-full rounded-lg bg-[var(--background)] px-3 py-2 text-[16px] sm:text-sm focus:outline-none resize-none border-none"
            disabled={submitting}
          />
          {isDragOver && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-[var(--primary)]/10 pointer-events-none">
              <span className="text-sm font-medium text-[var(--primary)]">
                Drop files here
              </span>
            </div>
          )}
        </div>
        <div className="mt-1">
          <PromptPicker
            apiKeyId={selectedAgent || null}
            onSelect={(text) => setMessageBody((prev) => prev ? `${prev}\n${text}` : text)}
          />
        </div>
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
                disabled={submitting}
                className="ml-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                aria-label={`Remove ${pf.file.name}`}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Tags</label>
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
            >
              {tag}
              <button
                type="button"
                onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                className="hover:text-red-600"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              const tag = tagInput.trim().toLowerCase();
              if (tag && !tags.includes(tag)) {
                setTags((prev) => [...prev, tag]);
              }
              setTagInput("");
            }
          }}
          placeholder="Type a tag and press Enter..."
          disabled={submitting}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[16px] sm:text-sm focus:outline-none focus:border-[var(--primary)]"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting || !title.trim() || (!messageBody.trim() && pendingFiles.filter((f) => !f.error).length === 0) || !selectedAgent}
          data-testid="thread-submit"
          className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {submitting ? "Creating..." : "Create Thread"}
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={submitting || pendingFiles.length >= FILE_LIMITS.MAX_FILES_PER_MESSAGE}
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
          onClick={() => router.push("/threads")}
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
        >
          Cancel
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
