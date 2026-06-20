import { describe, it, expect } from "vitest";
import { verifySignature, SIGNATURE_HEADER } from "../webhook";

async function generateSignature(
  payload: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("SIGNATURE_HEADER", () => {
  it("equals 'x-threadops-signature'", () => {
    expect(SIGNATURE_HEADER).toBe("x-threadops-signature");
  });
});

describe("verifySignature", () => {
  const secret = "test-webhook-secret";
  const payload = JSON.stringify({ event: "test", data: { id: 1 } });

  it("returns true for a valid signature", async () => {
    const sig = await generateSignature(payload, secret);
    expect(await verifySignature(payload, sig, secret)).toBe(true);
  });

  it("returns false for an invalid signature", async () => {
    expect(await verifySignature(payload, "bad_signature", secret)).toBe(false);
  });

  it("returns false when payload is tampered", async () => {
    const sig = await generateSignature(payload, secret);
    const tampered = payload + "x";
    expect(await verifySignature(tampered, sig, secret)).toBe(false);
  });

  it("returns false when wrong secret is used", async () => {
    const sig = await generateSignature(payload, secret);
    expect(await verifySignature(payload, sig, "wrong-secret")).toBe(false);
  });

  it("returns false for signatures of different length", async () => {
    expect(await verifySignature(payload, "short", secret)).toBe(false);
  });
});
