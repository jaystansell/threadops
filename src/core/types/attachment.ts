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
  created_at: string;
  purged_at: string | null;
}

export const FILE_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB
  MAX_FILES_PER_MESSAGE: 5,
  RETENTION_DAYS: 30,
  RATE_LIMIT_PER_MINUTE: 20,
} as const;

const ALLOWED_MIME_PREFIXES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
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

  const allowed = ALLOWED_MIME_PREFIXES.some((mime) =>
    contentType === mime,
  );
  if (!allowed) {
    return { ok: false, reason: `Content type ${contentType} is not allowed` };
  }

  return { ok: true };
}

const MAGIC_BYTES: Array<{ mime: string; bytes: number[] }> = [
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
];

export function validateMagicBytes(
  buffer: Uint8Array,
  claimedMime: string,
): { ok: true } | { ok: false; reason: string } {
  const rule = MAGIC_BYTES.find((r) => r.mime === claimedMime);
  if (!rule) {
    // Text-based types don't have reliable magic bytes
    return { ok: true };
  }

  if (buffer.length < rule.bytes.length) {
    return { ok: false, reason: "File too small to verify type" };
  }

  const matches = rule.bytes.every((b, i) => buffer[i] === b);
  if (!matches) {
    return {
      ok: false,
      reason: `File content does not match claimed type ${claimedMime}`,
    };
  }

  return { ok: true };
}
