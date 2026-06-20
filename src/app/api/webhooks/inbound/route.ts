import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createWebhookRepo } from "@/adapters/supabase/webhook-repo";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { hashKey } from "@/core/rules/api-key";
import { verifySignature, SIGNATURE_HEADER } from "@/core/rules/webhook";
import type { CompanyId } from "@/core/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return Response.json(
      { error: "Missing x-api-key header" },
      { status: 401 },
    );
  }

  const db = createServerClient();
  const apiKeyRepo = createApiKeyRepo(db);

  const keyHash = await hashKey(apiKey);
  const keyRecord = await apiKeyRepo.lookupByHash(keyHash);
  if (!keyRecord) {
    return Response.json({ error: "Invalid API key" }, { status: 401 });
  }

  await apiKeyRepo.touchLastUsed(keyRecord.id);

  const rawBody = await req.text();

  const webhookSecret = process.env.WEBHOOK_SIGNING_SECRET;
  if (webhookSecret) {
    const signature = req.headers.get(SIGNATURE_HEADER);
    if (!signature) {
      return Response.json(
        { error: "Missing webhook signature" },
        { status: 401 },
      );
    }
    const valid = await verifySignature(rawBody, signature, webhookSecret);
    if (!valid) {
      return Response.json(
        { error: "Invalid webhook signature" },
        { status: 403 },
      );
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json(
      { error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  const idempotencyKey =
    req.headers.get("x-idempotency-key") ??
    (payload.idempotency_key as string | undefined) ??
    "";

  if (!idempotencyKey) {
    return Response.json(
      { error: "Missing idempotency key" },
      { status: 400 },
    );
  }

  const companyId = keyRecord.company_id as CompanyId;
  const webhookRepo = createWebhookRepo(db);

  const existing = await webhookRepo.findByIdempotencyKey(
    companyId,
    idempotencyKey,
  );
  if (existing) {
    return Response.json(
      { message: "Already processed", delivery_id: existing.id },
      { status: 200 },
    );
  }

  let delivery;
  try {
    delivery = await webhookRepo.create({
      company_id: companyId,
      idempotency_key: idempotencyKey,
      source: (payload.source as string) ?? "unknown",
      event_type: (payload.event_type as string) ?? "unknown",
      payload,
    });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "23505"
    ) {
      const dup = await webhookRepo.findByIdempotencyKey(
        companyId,
        idempotencyKey,
      );
      return Response.json(
        { message: "Already processed", delivery_id: dup?.id },
        { status: 200 },
      );
    }
    throw err;
  }

  try {
    await webhookRepo.updateStatus(delivery.id, "processing");
    // Future: dispatch to event handlers based on event_type
    await webhookRepo.updateStatus(delivery.id, "succeeded");
  } catch (err) {
    await webhookRepo.updateStatus(
      delivery.id,
      "failed",
      err instanceof Error ? err.message : "Unknown error",
    );
  }

  return Response.json(
    { message: "Accepted", delivery_id: delivery.id },
    { status: 202 },
  );
}
