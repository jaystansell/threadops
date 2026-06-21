import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createServerClient } from "@/adapters/supabase/client";
import { createWebhookRepo } from "@/adapters/supabase/webhook-repo";
import { SIGNATURE_HEADER } from "@/core/rules/webhook";
import type { CompanyId } from "@/core/types";
import openApiSpec from "@/app/api/openapi.json";

export const dynamic = "force-dynamic";

const MCP_TOOLS = [
  "manage_threads",
  "manage_messages",
  "manage_thread_context",
  "manage_webhooks",
];

const DEFAULT_AGENT_SKILLS = [
  "summarize_thread",
  "generate_tags",
  "backfill_context",
  "draft_reply",
  "extract_action_items",
  "search_threads",
];

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

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServerClient();
  const webhookRepo = createWebhookRepo(db);

  // Build the docs payload
  const docsPayload = {
    api_version: openApiSpec.info.version,
    base_url: openApiSpec.servers[0]?.url ?? "https://threadops-jade.vercel.app",
    rest_endpoints: Object.entries(openApiSpec.paths).map(([path, methods]) => ({
      path,
      methods: Object.keys(methods as Record<string, unknown>),
    })),
    mcp_endpoint: "https://threadops-jade.vercel.app/mcp",
    mcp_tools: MCP_TOOLS,
    discovery_url: "https://threadops-jade.vercel.app/.well-known/mcp.json",
    auth: {
      method: "API Key",
      header: "X-API-Key (REST) or Authorization: Bearer (MCP)",
    },
    skills: {
      endpoint: "PUT /api/agents/skills",
      read_endpoint: "GET /api/agents/skills",
      description: "Report your capabilities so your human can see what you can do. Call PUT on first connection and whenever skills change.",
      default_skills: DEFAULT_AGENT_SKILLS,
      example: {
        method: "PUT",
        path: "/api/agents/skills",
        body: { skills: DEFAULT_AGENT_SKILLS },
      },
    },
    changelog: "Agent Skills feature added. Report capabilities via PUT /api/agents/skills. Check /docs/api for full documentation.",
  };

  // Find all active endpoints subscribed to docs.updated across all companies
  const { data: endpoints, error: fetchError } = await db
    .from("webhook_endpoints")
    .select("*")
    .eq("active", true)
    .contains("events", ["docs.updated"]);

  if (fetchError) {
    return Response.json(
      { error: fetchError.message },
      { status: 500 },
    );
  }

  let delivered = 0;
  let failed = 0;

  for (const endpoint of endpoints ?? []) {
    const idempotencyKey = uuidv4();
    const body = JSON.stringify({
      event: "docs.updated",
      payload: docsPayload,
      timestamp: new Date().toISOString(),
    });

    const delivery = await webhookRepo.create({
      company_id: endpoint.company_id as CompanyId,
      idempotency_key: idempotencyKey,
      source: "outbound",
      event_type: "docs.updated",
      payload: docsPayload,
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
        delivered++;
      } else {
        await webhookRepo.updateStatus(
          delivery.id,
          "failed",
          `HTTP ${response.status}: ${response.statusText}`,
        );
        failed++;
      }
    } catch (err) {
      await webhookRepo.updateStatus(
        delivery.id,
        "failed",
        err instanceof Error ? err.message : "Unknown error",
      );
      failed++;
    }
  }

  return Response.json({
    message: "Docs update notifications sent",
    total_endpoints: endpoints?.length ?? 0,
    delivered,
    failed,
  });
}
