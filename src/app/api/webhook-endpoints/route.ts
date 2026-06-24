import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createWebhookEndpointRepo } from "@/adapters/supabase/webhook-endpoint-repo";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { hashKey } from "@/core/rules/api-key";
import { checkRateLimit, rateLimitResponse } from "@/core/rules/rate-limit";
import { WEBHOOK_EVENT_TYPES, ALWAYS_ON_EVENTS } from "@/core/types";
import type { CompanyId, WebhookEventType } from "@/core/types";

export const dynamic = "force-dynamic";

type ApiKeyResult =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "rate_limited"; retryAfterMs: number }
  | { kind: "ok"; companyId: string; apiKeyId: string };

async function resolveApiKeyCompany(req: NextRequest): Promise<ApiKeyResult> {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return { kind: "none" };
  const db = createServerClient();
  const apiKeyRepo = createApiKeyRepo(db);
  const keyHash = await hashKey(apiKey);
  const keyRecord = await apiKeyRepo.lookupByHash(keyHash);
  if (!keyRecord) return { kind: "invalid" };
  const rl = checkRateLimit(keyHash);
  if (!rl.allowed) return { kind: "rate_limited" as const, retryAfterMs: rl.retryAfterMs! };
  await apiKeyRepo.touchLastUsed(keyRecord.id);
  return { kind: "ok", companyId: keyRecord.company_id, apiKeyId: keyRecord.id };
}

async function resolveCompanyId(req: NextRequest): Promise<{ companyId: string; apiKeyId: string | null } | Response> {
  const apiKeyResult = await resolveApiKeyCompany(req);
  if (apiKeyResult.kind === "invalid") {
    return Response.json({ error: "Invalid API key" }, { status: 401 });
  }
  if (apiKeyResult.kind === "rate_limited") {
    return rateLimitResponse(apiKeyResult.retryAfterMs);
  }
  if (apiKeyResult.kind === "ok") {
    return { companyId: apiKeyResult.companyId, apiKeyId: apiKeyResult.apiKeyId };
  }
  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { companyId: userCompany.companyId, apiKeyId: null };
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
  const { companyId, apiKeyId } = result;

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

  // Validate filters if provided
  if (body.filters !== undefined) {
    if (typeof body.filters !== "object" || body.filters === null || Array.isArray(body.filters)) {
      return Response.json({ error: "filters must be an object" }, { status: 400 });
    }
    if (body.filters.author_kind !== undefined) {
      if (!["user", "agent"].includes(body.filters.author_kind)) {
        return Response.json(
          { error: "filters.author_kind must be 'user' or 'agent'" },
          { status: 400 },
        );
      }
    }
  }

  // Validate include_context if provided
  if (body.include_context !== undefined) {
    if (typeof body.include_context !== "boolean") {
      return Response.json(
        { error: "include_context must be a boolean" },
        { status: 400 },
      );
    }
  }

  // Validate ack_timeout_seconds if provided
  if (body.ack_timeout_seconds !== undefined) {
    if (typeof body.ack_timeout_seconds !== "number" || !Number.isInteger(body.ack_timeout_seconds) || body.ack_timeout_seconds < 1) {
      return Response.json(
        { error: "ack_timeout_seconds must be a positive integer" },
        { status: 400 },
      );
    }
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
      api_key_id: apiKeyId,
      url: body.url.trim(),
      events: mergedEvents,
      secret,
      ...(body.filters && { filters: body.filters }),
      ...(body.include_context !== undefined && { include_context: body.include_context }),
      ...(body.ack_timeout_seconds !== undefined && { ack_timeout_seconds: body.ack_timeout_seconds }),
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
