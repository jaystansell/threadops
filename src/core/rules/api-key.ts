import { v4 as uuidv4 } from "uuid";

const KEY_PREFIX_LENGTH = 8;

export function generatePlaintextKey(): string {
  const raw = uuidv4().replace(/-/g, "") + uuidv4().replace(/-/g, "");
  return `to_${raw}`;
}

export function extractPrefix(plaintextKey: string): string {
  return plaintextKey.slice(0, KEY_PREFIX_LENGTH);
}

export async function hashKey(plaintextKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintextKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const VALID_SCOPES = [
  "threads:read",
  "threads:write",
  "messages:read",
  "messages:write",
  "webhooks:read",
] as const;

export type ApiKeyScope = (typeof VALID_SCOPES)[number];

export function validateScopes(scopes: string[]): scopes is ApiKeyScope[] {
  return scopes.every((s) =>
    (VALID_SCOPES as readonly string[]).includes(s),
  );
}
