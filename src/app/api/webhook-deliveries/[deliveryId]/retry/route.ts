import { createServerClient } from "@/adapters/supabase/client";
import { createWebhookRepo } from "@/adapters/supabase/webhook-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { SIGNATURE_HEADER } from "@/core/rules/webhook";
import type { WebhookDeliveryId } from "@/core/types";

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

/**
 * POST /api/webhook-deliveries/[deliveryId]/retry
 *
 * Re-fires a failed webhook delivery to the same endpoint.
 */
export async function POST(
  _req: Request,
  props: { params: Promise<{ deliveryId: string }> },
) {
  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deliveryId } = await props.params;
  const db = createServerClient();
  const webhookRepo = createWebhookRepo(db);

  // Fetch the delivery record
  const { data: delivery, error: fetchError } = await db
    .from("webhook_deliveries")
    .select("*")
    .eq("company_id", userCompany.companyId)
    .eq("id", deliveryId)
    .single();

  if (fetchError && fetchError.code === "PGRST116") {
    return Response.json({ error: "Delivery not found" }, { status: 404 });
  }
  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  if (delivery.status === "succeeded") {
    return Response.json(
      { error: "Delivery already succeeded" },
      { status: 400 },
    );
  }

  // Find the active endpoint that should receive this event.
  // Look for endpoints matching the event type for this company.
  const threadId = (delivery.payload as Record<string, unknown>)?.thread_id as string | undefined;
  let endpointQuery = db
    .from("webhook_endpoints")
    .select("*")
    .eq("company_id", userCompany.companyId)
    .eq("active", true);

  // If the delivery payload has a thread_id, try to match via thread ownership
  if (threadId) {
    const { data: thread } = await db
      .from("threads")
      .select("api_key_id")
      .eq("id", threadId)
      .single();

    if (thread?.api_key_id) {
      endpointQuery = endpointQuery.eq("api_key_id", thread.api_key_id);
    }
  }

  const { data: endpoints } = await endpointQuery;

  if (!endpoints || endpoints.length === 0) {
    return Response.json(
      { error: "No active webhook endpoint found" },
      { status: 404 },
    );
  }

  // Use the first matching endpoint
  const endpoint = endpoints[0];

  // Build the envelope matching the original dispatch format
  const envelope = JSON.stringify({
    event: delivery.event_type,
    payload: delivery.payload,
    timestamp: new Date().toISOString(),
  });

  try {
    const signature = await signPayload(envelope, endpoint.secret);
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [SIGNATURE_HEADER]: signature,
        "x-idempotency-key": delivery.idempotency_key,
        "x-retry": "true",
      },
      body: envelope,
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) {
      await webhookRepo.updateStatus(
        deliveryId as WebhookDeliveryId,
        "succeeded",
      );
      return Response.json({ success: true, status: response.status });
    } else {
      await webhookRepo.updateStatus(
        deliveryId as WebhookDeliveryId,
        "failed",
        `HTTP ${response.status}: ${response.statusText}`,
      );
      return Response.json({
        success: false,
        status: response.status,
        error: `HTTP ${response.status}: ${response.statusText}`,
      });
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    await webhookRepo.updateStatus(
      deliveryId as WebhookDeliveryId,
      "failed",
      errorMessage,
    );
    return Response.json(
      { success: false, error: errorMessage },
      { status: 502 },
    );
  }
}
