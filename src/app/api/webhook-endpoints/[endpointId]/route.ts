import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createWebhookEndpointRepo } from "@/adapters/supabase/webhook-endpoint-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { WEBHOOK_EVENT_TYPES } from "@/core/types";
import type { WebhookEndpointId, WebhookEventType } from "@/core/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/webhook-endpoints/[endpointId]">,
) {
  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    update.events = body.events;
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

  const db = createServerClient();
  const repo = createWebhookEndpointRepo(db);

  try {
    const endpoint = await repo.update(
      userCompany.companyId,
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
  _req: NextRequest,
  ctx: RouteContext<"/api/webhook-endpoints/[endpointId]">,
) {
  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { endpointId } = await ctx.params;
  const db = createServerClient();
  const repo = createWebhookEndpointRepo(db);

  try {
    await repo.remove(
      userCompany.companyId,
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
