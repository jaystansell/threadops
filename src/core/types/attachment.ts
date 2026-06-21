export type AttachmentId = string & { readonly __brand: "AttachmentId" };

export interface Attachment {
  id: AttachmentId;
  message_id: string;
  thread_id: string;
  company_id: string;
  filename: string;
  file_size: number;
  content_type: string;
  storage_path: string;
  uploaded_by: string;
  uploader_kind: "user" | "agent";
  created_at: string;
  expires_at: string;
}

export const FILE_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB
  MAX_FILES_PER_MESSAGE: 5,
  RETENTION_DAYS: 30,
} as const;

const ALLOWED_MIME_PREFIXES = [
  "image/",
  "text/",
  "application/pdf",
  "application/json",
  "application/csv",
] as const;

const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".sh", ".ps1", ".vbs", ".js", ".mjs",
  ".dll", ".so", ".dylib", ".app", ".msi", ".deb", ".rpm",
  ".com", ".scr", ".pif", ".hta", ".cpl", ".jar", ".war",
]);

export function isAllowedFile(
  filename: string,
  contentType: string,
  size: number,
): { ok: true } | { ok: false; reason: string } {
  if (size > FILE_LIMITS.MAX_FILE_SIZE) {
    return {
      ok: false,
      reason: `File exceeds ${FILE_LIMITS.MAX_FILE_SIZE / 1024 / 1024} MB limit`,
    };
  }

  const ext = filename.lastIndexOf(".") >= 0
    ? filename.slice(filename.lastIndexOf(".")).toLowerCase()
    : "";

  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { ok: false, reason: `File type ${ext} is not allowed` };
  }

  const allowed = ALLOWED_MIME_PREFIXES.some((prefix) =>
    contentType.startsWith(prefix),
  );
  if (!allowed) {
    return { ok: false, reason: `Content type ${contentType} is not allowed` };
  }

  return { ok: true };
}
