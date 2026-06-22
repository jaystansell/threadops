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
  excludeApiKeyId?: string | null,
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
      // If a thread has an owner, only endpoints with a matching api_key_id receive
      // the event. If a thread has NO owner (legacy / human-created), only deliver
      // to endpoints with NULL api_key_id (legacy endpoints not tied to any agent).
      // This prevents cross-agent data bleed where every agent receives and responds
      // to every other agent's threads.
      const endpoints = eventType === "docs.updated"
        ? allEndpoints
        : allEndpoints.filter((ep) => {
            // Echo suppression: never deliver to the agent that triggered the event
            if (excludeApiKeyId && ep.api_key_id === excludeApiKeyId) return false;
            if (!agentApiKeyId) {
              // No thread owner: only deliver to legacy endpoints (no agent binding)
              return !ep.api_key_id;
            }
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
