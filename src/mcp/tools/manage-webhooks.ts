import { v4 as uuidv4 } from "uuid";
import type { SupabaseClient } from "../../adapters/supabase/client";
import { createWebhookEndpointRepo } from "../../adapters/supabase/webhook-endpoint-repo";
import { createWebhookRepo } from "../../adapters/supabase/webhook-repo";
import { SIGNATURE_HEADER } from "../../core/rules/webhook";
import { ALWAYS_ON_EVENTS } from "../../core/types";
import type { AuthContext } from "../auth";
import type { CompanyId, WebhookEndpointFilters, WebhookEndpointId } from "../../core/types";
import { getWebhookHealth } from "./webhook-health";

interface UpdateWebhookInput {
  endpoint_id: string;
  url?: string;
  events?: string[];
  filters?: WebhookEndpointFilters;
  active?: boolean;
}

async function getOwnedEndpoint(
  db: SupabaseClient,
  auth: AuthContext,
  endpointId: string,
) {
  const endpoint = await createWebhookEndpointRepo(db).getByAgent(
    auth.companyId as CompanyId,
    auth.keyId,
    endpointId as WebhookEndpointId,
  );
  if (!endpoint) throw new Error("Webhook endpoint not found or does not belong to this agent");
  return endpoint;
}

export async function updateWebhook(
  db: SupabaseClient,
  auth: AuthContext,
  input: UpdateWebhookInput,
) {
  await getOwnedEndpoint(db, auth, input.endpoint_id);
  const update = {
    ...(input.url !== undefined && { url: input.url }),
    ...(input.events !== undefined && {
      events: Array.from(new Set([...input.events, ...ALWAYS_ON_EVENTS])),
    }),
    ...(input.filters !== undefined && { filters: input.filters }),
    ...(input.active !== undefined && { active: input.active }),
  };
  return createWebhookEndpointRepo(db).update(
    auth.companyId as CompanyId,
    input.endpoint_id as WebhookEndpointId,
    update,
  );
}

export async function deactivateWebhook(
  db: SupabaseClient,
  auth: AuthContext,
  endpointId: string,
) {
  await getOwnedEndpoint(db, auth, endpointId);
  return createWebhookEndpointRepo(db).deactivate(
    auth.companyId as CompanyId,
    auth.keyId,
    endpointId as WebhookEndpointId,
  );
}

export async function deleteWebhook(
  db: SupabaseClient,
  auth: AuthContext,
  endpointId: string,
) {
  await getOwnedEndpoint(db, auth, endpointId);
  await createWebhookEndpointRepo(db).remove(
    auth.companyId as CompanyId,
    endpointId as WebhookEndpointId,
  );
  return { deleted: true, endpoint_id: endpointId };
}

export async function testWebhook(
  db: SupabaseClient,
  auth: AuthContext,
  endpointId: string,
) {
  const endpoint = await getOwnedEndpoint(db, auth, endpointId);
  const idempotencyKey = uuidv4();
  const payload = {
    test: true,
    body: "This is a test webhook from Threadzy.",
    author_kind: "user",
  };
  const body = JSON.stringify({
    event: "webhook.test",
    payload,
    timestamp: new Date().toISOString(),
  });
  const delivery = await createWebhookRepo(db).create({
    company_id: auth.companyId as CompanyId,
    endpoint_id: endpoint.id,
    idempotency_key: idempotencyKey,
    source: "outbound",
    event_type: "webhook.test",
    payload,
  });
  const startedAt = performance.now();
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
    await createWebhookRepo(db).updateStatus(
      delivery.id,
      response.ok ? "succeeded" : "failed",
      response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
    );
    return {
      success: response.ok,
      status: response.status,
      latency_ms: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await createWebhookRepo(db).updateStatus(delivery.id, "failed", message);
    return {
      success: false,
      status: null,
      latency_ms: Math.round(performance.now() - startedAt),
      error: message,
    };
  }
}

export async function diagnoseWebhooks(db: SupabaseClient, auth: AuthContext) {
  return getWebhookHealth(db, auth);
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
