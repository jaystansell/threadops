import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createWebhookEndpointRepo } from "@/adapters/supabase/webhook-endpoint-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { WEBHOOK_EVENT_TYPES } from "@/core/types";
import type { WebhookEventType } from "@/core/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServerClient();
  const repo = createWebhookEndpointRepo(db);

  try {
    const endpoints = await repo.listByCompany(userCompany.companyId);
    return Response.json(endpoints);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const db = createServerClient();
  const repo = createWebhookEndpointRepo(db);

  try {
    const endpoint = await repo.create({
      company_id: userCompany.companyId,
      url: body.url.trim(),
      events: body.events,
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
