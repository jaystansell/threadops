import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createServerClient } from "@/adapters/supabase/client";
import { createWebhookEndpointRepo } from "@/adapters/supabase/webhook-endpoint-repo";
import { createWebhookRepo } from "@/adapters/supabase/webhook-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { SIGNATURE_HEADER } from "@/core/rules/webhook";
import type { CompanyId, WebhookEndpointId } from "@/core/types";

export const dynamic = "force-dynamic";

async function signPayload(payload: string, secret: string): Promise<string> {
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

export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/webhook-endpoints/[endpointId]/test">,
) {
  // Cookie auth only — no API key auth for test webhooks
  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { companyId } = userCompany;

  const { endpointId } = await ctx.params;
  const db = createServerClient();
  const endpointRepo = createWebhookEndpointRepo(db);
  const webhookRepo = createWebhookRepo(db);

  // Verify endpoint belongs to this user's company
  const endpoint = await endpointRepo.getById(
    companyId as CompanyId,
    endpointId as WebhookEndpointId,
  );
  if (!endpoint) {
    return Response.json({ error: "Endpoint not found" }, { status: 404 });
  }

  // Build test payload
  const testPayload = {
    test: true,
    thread_id: "test-thread-id",
    body: "This is a test webhook from Threadzy. If you received this, your webhook endpoint is working correctly.",
    author_kind: "user",
    author_name: "Threadzy Test",
  };

  const idempotencyKey = uuidv4();
  const body = JSON.stringify({
    event: "webhook.test",
    payload: testPayload,
    timestamp: new Date().toISOString(),
  });

  // Record delivery
  const delivery = await webhookRepo.create({
    company_id: companyId,
    idempotency_key: idempotencyKey,
    source: "outbound",
    event_type: "webhook.test",
    payload: testPayload,
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

    const responseBody = await response.text().catch(() => "");

    if (response.ok) {
      await webhookRepo.updateStatus(delivery.id, "succeeded");
    } else {
      await webhookRepo.updateStatus(
        delivery.id,
        "failed",
        `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return Response.json({
      success: response.ok,
      status: response.status,
      body: responseBody,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    await webhookRepo.updateStatus(delivery.id, "failed", errorMessage);

    return Response.json(
      { success: false, error: errorMessage },
      { status: 502 },
    );
  }
}
