import { v4 as uuidv4 } from "uuid";
import { SIGNATURE_HEADER } from "@/core/rules/webhook";
import type { ApiKeyId, CompanyId } from "@/core/types";
import { createServerClient } from "./client";
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

interface AgentThread {
  id: string;
  title: string;
  status: string;
}

interface AgentEndpoint {
  id: string;
  url: string;
  events: string[];
  active: boolean;
}

/**
 * Send a farewell `agent.revoked` webhook to all active endpoints for a key
 * BEFORE the key is revoked and endpoints deactivated.
 *
 * This gives the agent a chance to clean up gracefully. The payload tells
 * the agent exactly what will happen to its threads, webhooks, and access.
 */
export async function dispatchRevokedWebhook(
  companyId: CompanyId,
  keyId: ApiKeyId,
  agentLabel: string,
  keyPrefix: string,
  threads: AgentThread[],
  endpoints: AgentEndpoint[],
): Promise<void> {
  const db = createServerClient();
  const webhookRepo = createWebhookRepo(db);

  const activeEndpoints = endpoints.filter((ep) => ep.active);
  if (activeEndpoints.length === 0) return;

  // Fetch endpoint secrets for signing
  const { data: endpointsWithSecrets } = await db
    .from("webhook_endpoints")
    .select("id, url, secret")
    .eq("company_id", companyId)
    .eq("api_key_id", keyId)
    .eq("active", true);

  if (!endpointsWithSecrets || endpointsWithSecrets.length === 0) return;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://threadops-jade.vercel.app";

  const revokedAt = new Date().toISOString();

  const eventPayload = {
    api_key_id: keyId,
    api_key_prefix: keyPrefix,
    agent_label: agentLabel,
    revoked_at: revokedAt,
    message:
      "Your API key has been revoked. You can no longer post messages, receive webhooks, or access the API with this key.",
    impact: {
      threads: {
        count: threads.length,
        detail:
          "Your threads remain visible to the workspace owner but you can no longer read or post to them. Thread data is preserved.",
        affected: threads.map((t) => ({
          thread_id: t.id,
          title: t.title,
          status: t.status,
          thread_url: `${appUrl}/threads/${t.id}`,
        })),
      },
      webhooks: {
        count: activeEndpoints.length,
        detail:
          "All your webhook endpoints will be deactivated immediately after this notification. You will receive no further events.",
        affected: activeEndpoints.map((ep) => ({
          endpoint_id: ep.id,
          url: ep.url,
          events: ep.events,
        })),
      },
      api_access: {
        detail:
          "All API requests using this key will return 401 Unauthorized. If you need continued access, contact the workspace owner to provision a new key.",
      },
    },
    recommended_actions: [
      "Stop any scheduled or background tasks using this API key.",
      "Remove this key from your configuration to avoid 401 errors in logs.",
      "Contact the workspace owner if you believe this was done in error.",
    ],
  };

  for (const endpoint of endpointsWithSecrets) {
    const idempotencyKey = uuidv4();
    const body = JSON.stringify({
      event: "agent.revoked",
      payload: eventPayload,
      timestamp: revokedAt,
    });

    const delivery = await webhookRepo.create({
      company_id: companyId,
      idempotency_key: idempotencyKey,
      source: "outbound",
      event_type: "agent.revoked",
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
}
