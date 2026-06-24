import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createWebhookEndpointRepo } from "@/adapters/supabase/webhook-endpoint-repo";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { hashKey } from "@/core/rules/api-key";
import { checkRateLimit, rateLimitResponse } from "@/core/rules/rate-limit";
import { WEBHOOK_EVENT_TYPES, ALWAYS_ON_EVENTS } from "@/core/types";
import type { CompanyId, WebhookEndpointId, WebhookEventType } from "@/core/types";

export const dynamic = "force-dynamic";

async function resolveCompanyId(req: NextRequest): Promise<{ companyId: string } | Response> {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) {
    const db = createServerClient();
    const apiKeyRepo = createApiKeyRepo(db);
    const keyHash = await hashKey(apiKey);
    const keyRecord = await apiKeyRepo.lookupByHash(keyHash);
    if (!keyRecord) {
      return Response.json({ error: "Invalid API key" }, { status: 401 });
    }
    const rl = checkRateLimit(keyHash);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs!);
    await apiKeyRepo.touchLastUsed(keyRecord.id);
    return { companyId: keyRecord.company_id };
  }
  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { companyId: userCompany.companyId };
}

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/webhook-endpoints/[endpointId]">,
) {
  const result = await resolveCompanyId(req);
  if (result instanceof Response) return result;
  const { companyId } = result;

  const { endpointId } = await ctx.params;
  const body = await req.json();

  const update: Record<string, unknown> = {};

  if (body.url !== undefined) {
    if (typeof body.url !== "string" || !body.url.trim()) {
      return Response.json(
        { error: "url must be a non-empty string" },
        { status: 400 },
      );
    }
    try {
      new URL(body.url);
    } catch {
      return Response.json(
        { error: "url must be a valid URL" },
        { status: 400 },
      );
    }
    update.url = body.url.trim();
  }

  if (body.events !== undefined) {
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
        { error: `Invalid event types: ${invalidEvents.join(", ")}` },
        { status: 400 },
      );
    }
    // Ensure always-on events cannot be removed
    update.events = Array.from(
      new Set([...body.events, ...ALWAYS_ON_EVENTS]),
    );
  }

  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") {
      return Response.json(
        { error: "active must be a boolean" },
        { status: 400 },
      );
    }
    update.active = body.active;
  }

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
    update.filters = body.filters;
  }

  if (body.include_context !== undefined) {
    if (typeof body.include_context !== "boolean") {
      return Response.json(
        { error: "include_context must be a boolean" },
        { status: 400 },
      );
    }
    update.include_context = body.include_context;
  }

  if (body.ack_timeout_seconds !== undefined) {
    if (typeof body.ack_timeout_seconds !== "number" || !Number.isInteger(body.ack_timeout_seconds) || body.ack_timeout_seconds < 1) {
      return Response.json(
        { error: "ack_timeout_seconds must be a positive integer" },
        { status: 400 },
      );
    }
    update.ack_timeout_seconds = body.ack_timeout_seconds;
  }

  const db = createServerClient();
  const repo = createWebhookEndpointRepo(db);

  try {
    const endpoint = await repo.update(
      companyId as CompanyId,
      endpointId as WebhookEndpointId,
      update,
    );
    return Response.json(endpoint);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: RouteContext<"/api/webhook-endpoints/[endpointId]">,
) {
  const result = await resolveCompanyId(req);
  if (result instanceof Response) return result;
  const { companyId } = result;

  const { endpointId } = await ctx.params;
  const db = createServerClient();
  const repo = createWebhookEndpointRepo(db);

  try {
    await repo.remove(
      companyId as CompanyId,
      endpointId as WebhookEndpointId,
    );
    return Response.json({ message: "Deleted" });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
