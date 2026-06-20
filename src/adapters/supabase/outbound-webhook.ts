import { after } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { SIGNATURE_HEADER } from "@/core/rules/webhook";
import type { CompanyId } from "@/core/types";
import { createServerClient } from "./client";
import { createWebhookEndpointRepo } from "./webhook-endpoint-repo";
import { createWebhookRepo } from "./webhook-repo";

async function signPayload(
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

export function dispatchOutboundWebhooks(
  companyId: CompanyId,
  eventType: string,
  eventPayload: Record<string, unknown>,
  agentApiKeyId?: string | null,
): void {
  const work = async () => {
    try {
      const db = createServerClient();
      const endpointRepo = createWebhookEndpointRepo(db);
      const webhookRepo = createWebhookRepo(db);

      const allEndpoints = await endpointRepo.listActiveForEvent(
        companyId,
        eventType,
      );

      // Agent-scoped delivery: only deliver thread events to the owning agent's endpoint.
      // docs.updated events go to all endpoints (no thread ownership).
      const endpoints = eventType === "docs.updated"
        ? allEndpoints
        : allEndpoints.filter((ep) => {
            if (!agentApiKeyId) return true;
            if (!ep.api_key_id) return true;
            return ep.api_key_id === agentApiKeyId;
          });

      for (const endpoint of endpoints) {
        const idempotencyKey = uuidv4();
        const body = JSON.stringify({
          event: eventType,
          payload: eventPayload,
          timestamp: new Date().toISOString(),
        });

        const delivery = await webhookRepo.create({
          company_id: companyId,
          idempotency_key: idempotencyKey,
          source: "outbound",
          event_type: eventType,
          payload: eventPayload,
        });

        try {
          const signature = await signPayload(body, endpoint.secret);
          const response = await fetch(endpoint.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              [SIGNATURE_HEADER]: signature,
              "x-idempotency-key": idempotencyKey,
            },
            body,
            signal: AbortSignal.timeout(10_000),
          });

          if (response.ok) {
            await webhookRepo.updateStatus(delivery.id, "succeeded");
          } else {
            await webhookRepo.updateStatus(
              delivery.id,
              "failed",
              `HTTP ${response.status}: ${response.statusText}`,
            );
          }
        } catch (err) {
          await webhookRepo.updateStatus(
            delivery.id,
            "failed",
            err instanceof Error ? err.message : "Unknown error",
          );
        }
      }
    } catch {
      // Fire-and-forget: swallow top-level errors so the API response is not blocked
    }
  };

  // Use Next.js after() to keep the serverless function alive for background work
  after(work);
}
