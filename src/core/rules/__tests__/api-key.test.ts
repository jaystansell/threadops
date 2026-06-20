import { describe, it, expect } from "vitest";
import {
  generatePlaintextKey,
  extractPrefix,
  hashKey,
  validateScopes,
  VALID_SCOPES,
} from "../api-key";

describe("generatePlaintextKey", () => {
  it("starts with 'to_' prefix", () => {
    const key = generatePlaintextKey();
    expect(key.startsWith("to_")).toBe(true);
  });

  it("has 64 hex chars after the prefix", () => {
    const key = generatePlaintextKey();
    const hex = key.slice(3);
    expect(hex).toHaveLength(64);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique keys on each call", () => {
    const a = generatePlaintextKey();
    const b = generatePlaintextKey();
    expect(a).not.toBe(b);
  });
});

describe("extractPrefix", () => {
  it("returns the first 8 characters", () => {
    const key = "to_abcdef1234567890";
    expect(extractPrefix(key)).toBe("to_abcde");
  });
});

describe("hashKey", () => {
  it("returns a 64-char hex string (SHA-256)", async () => {
    const hash = await hashKey("to_test_key");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces deterministic output for the same input", async () => {
    const a = await hashKey("to_same_key");
    const b = await hashKey("to_same_key");
    expect(a).toBe(b);
  });

  it("produces different output for different inputs", async () => {
    const a = await hashKey("to_key_one");
    const b = await hashKey("to_key_two");
    expect(a).not.toBe(b);
  });
});

describe("validateScopes", () => {
  it("returns true for valid scopes", () => {
    expect(validateScopes(["threads:read", "messages:write"])).toBe(true);
  });

  it("returns true for all valid scopes", () => {
    expect(validateScopes([...VALID_SCOPES])).toBe(true);
  });

  it("returns true for an empty array", () => {
    expect(validateScopes([])).toBe(true);
  });

  it("returns false for invalid scopes", () => {
    expect(validateScopes(["invalid:scope"])).toBe(false);
  });

  it("returns false when one scope is invalid among valid ones", () => {
    expect(validateScopes(["threads:read", "bad:scope"])).toBe(false);
  });
});
