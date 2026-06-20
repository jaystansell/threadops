import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createWebhookEndpointRepo } from "@/adapters/supabase/webhook-endpoint-repo";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { hashKey } from "@/core/rules/api-key";
import { WEBHOOK_EVENT_TYPES, ALWAYS_ON_EVENTS } from "@/core/types";
import type { CompanyId, WebhookEventType } from "@/core/types";

export const dynamic = "force-dynamic";

type ApiKeyResult =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "ok"; companyId: string };

async function resolveApiKeyCompany(req: NextRequest): Promise<ApiKeyResult> {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return { kind: "none" };
  const db = createServerClient();
  const apiKeyRepo = createApiKeyRepo(db);
  const keyHash = await hashKey(apiKey);
  const keyRecord = await apiKeyRepo.lookupByHash(keyHash);
  if (!keyRecord) return { kind: "invalid" };
  await apiKeyRepo.touchLastUsed(keyRecord.id);
  return { kind: "ok", companyId: keyRecord.company_id };
}

async function resolveCompanyId(req: NextRequest): Promise<{ companyId: string } | Response> {
  const apiKeyResult = await resolveApiKeyCompany(req);
  if (apiKeyResult.kind === "invalid") {
    return Response.json({ error: "Invalid API key" }, { status: 401 });
  }
  if (apiKeyResult.kind === "ok") {
    return { companyId: apiKeyResult.companyId };
  }
  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { companyId: userCompany.companyId };
}

export async function GET(req: NextRequest) {
  const result = await resolveCompanyId(req);
  if (result instanceof Response) return result;
  const { companyId } = result;

  const db = createServerClient();
  const repo = createWebhookEndpointRepo(db);

  try {
    const endpoints = await repo.listByCompany(companyId as CompanyId);
    return Response.json(endpoints);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const result = await resolveCompanyId(req);
  if (result instanceof Response) return result;
  const { companyId } = result;

  const body = await req.json();

  if (!body.url || typeof body.url !== "string" || !body.url.trim()) {
    return Response.json(
      { error: "url is required and must be a non-empty string" },
      { status: 400 },
    );
  }

  try {
    new URL(body.url);
  } catch {
    return Response.json({ error: "url must be a valid URL" }, { status: 400 });
  }

  if (!Array.isArray(body.events) || body.events.length === 0) {
    return Response.json(
      { error: "events must be a non-empty array" },
      { status: 400 },
    );
  }

  const invalidEvents = body.events.filter(
    (e: string) => !WEBHOOK_EVENT_TYPES.includes(e as WebhookEventType),
  );
  if (invalidEvents.length > 0) {
    return Response.json(
      {
        error: `Invalid event types: ${invalidEvents.join(", ")}. Valid types: ${WEBHOOK_EVENT_TYPES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const secret = generateSecret();

  // Merge user-selected events with always-on events
  const mergedEvents = Array.from(
    new Set([...body.events, ...ALWAYS_ON_EVENTS]),
  );

  const db = createServerClient();
  const repo = createWebhookEndpointRepo(db);

  try {
    const endpoint = await repo.create({
      company_id: companyId as CompanyId,
      url: body.url.trim(),
      events: mergedEvents,
      secret,
    });
    return Response.json(endpoint, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
