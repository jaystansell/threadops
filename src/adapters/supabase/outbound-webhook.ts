import { after } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { SIGNATURE_HEADER } from "@/core/rules/webhook";
import type { CompanyId } from "@/core/types";
import { createServerClient, type SupabaseClient } from "./client";
import { createWebhookEndpointRepo } from "./webhook-endpoint-repo";
import { createWebhookRepo } from "./webhook-repo";

interface WebhookContext {
  thread_summary: string | null;
  thread_tags: string[];
  thread_status: string;
  thread_title: string;
  recent_messages: {
    body: string;
    author_kind: string;
    author_name: string | null;
    created_at: string;
  }[];
  message_count: number;
  reply_endpoint: string;
  ack_endpoint: string;
}

async function fetchThreadContext(
  db: SupabaseClient,
  threadId: string,
): Promise<WebhookContext | null> {
  try {
    const [threadResult, messagesResult, countResult, tagsResult] =
      await Promise.all([
        db
          .from("threads")
          .select("title, status, summary")
          .eq("id", threadId)
          .single(),
        db
          .from("messages")
          .select("body, author_kind, author_name, created_at")
          .eq("thread_id", threadId)
          .order("created_at", { ascending: false })
          .limit(5),
        db
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("thread_id", threadId),
        db
          .from("thread_tags")
          .select("tag")
          .eq("thread_id", threadId),
      ]);

    if (threadResult.error || !threadResult.data) return null;

    const thread = threadResult.data;
    const recentMessages = (messagesResult.data ?? []).map(
      (m: { body: string; author_kind: string; author_name: string | null; created_at: string }) => ({
        body: m.body.length > 500 ? m.body.slice(0, 500) : m.body,
        author_kind: m.author_kind,
        author_name: m.author_name,
        created_at: m.created_at,
      }),
    );

    return {
      thread_summary: thread.summary ?? null,
      thread_tags: (tagsResult.data ?? []).map((t: { tag: string }) => t.tag),
      thread_status: thread.status,
      thread_title: thread.title,
      recent_messages: recentMessages,
      message_count: countResult.count ?? 0,
      reply_endpoint: `POST /api/threads/${threadId}/messages`,
      ack_endpoint: `POST /api/threads/${threadId}/ack`,
    };
  } catch {
    return null;
  }
}

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

export function dispatchOutboundWebhooks(
  companyId: CompanyId,
  eventType: string,
  eventPayload: Record<string, unknown>,
  agentApiKeyId?: string | null,
  excludeApiKeyId?: string | null,
): void {
  const work = async () => {
    try {
      const db = createServerClient();
      const endpointRepo = createWebhookEndpointRepo(db);
      const webhookRepo = createWebhookRepo(db);

      const allEndpointsRaw = await endpointRepo.listActiveForEvent(
        companyId,
        eventType,
      );

      // Skip endpoints whose API key has been revoked
      const keyIds = [...new Set(allEndpointsRaw.map((ep) => ep.api_key_id).filter(Boolean))] as string[];
      let revokedKeyIds = new Set<string>();
      if (keyIds.length > 0) {
        const { data: revokedRows } = await db
          .from("api_keys")
          .select("id")
          .in("id", keyIds)
          .not("revoked_at", "is", null);
        revokedKeyIds = new Set((revokedRows ?? []).map((r: { id: string }) => r.id));
      }
      const allEndpoints = allEndpointsRaw.filter(
        (ep) => !ep.api_key_id || !revokedKeyIds.has(ep.api_key_id),
      );

      // Agent-scoped delivery: only deliver thread events to the owning agent's endpoint.
      // docs.updated events go to all endpoints (no thread ownership).
      // If a thread has an owner, only endpoints with a matching api_key_id receive
      // the event. If a thread has NO owner (legacy / human-created), only deliver
      // to endpoints with NULL api_key_id (legacy endpoints not tied to any agent).
      // This prevents cross-agent data bleed where every agent receives and responds
      // to every other agent's threads.
      const endpoints = eventType === "docs.updated"
        ? allEndpoints
        : allEndpoints.filter((ep) => {
            // Echo suppression: never deliver to the agent that triggered the event
            if (excludeApiKeyId && ep.api_key_id === excludeApiKeyId) return false;
            if (!agentApiKeyId) {
              // No thread owner: only deliver to legacy endpoints (no agent binding)
              return !ep.api_key_id;
            }
            return ep.api_key_id === agentApiKeyId;
          });

      // Author-kind filter: skip delivery if endpoint has an author_kind filter
      // that doesn't match the event payload's author_kind.
      const filtered = endpoints.filter((ep) => {
        const authorKindFilter = ep.filters?.author_kind;
        if (!authorKindFilter) return true;
        return eventPayload.author_kind === authorKindFilter;
      });

      // Fetch thread context once if any endpoint wants it
      const threadId = eventPayload.thread_id as string | undefined;
      let context: WebhookContext | null = null;
      const anyWantsContext = filtered.some((ep) => ep.include_context !== false);
      if (threadId && anyWantsContext) {
        context = await fetchThreadContext(db, threadId);
      }

      for (const endpoint of filtered) {
        const idempotencyKey = uuidv4();
        const envelope: Record<string, unknown> = {
          event: eventType,
          payload: eventPayload,
          timestamp: new Date().toISOString(),
        };
        if (context && endpoint.include_context !== false) {
          envelope.context = context;
        }
        const body = JSON.stringify(envelope);

        const delivery = await webhookRepo.create({
          company_id: companyId,
          idempotency_key: idempotencyKey,
          source: "outbound",
          event_type: eventType,
          payload: eventPayload,
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
          } else {
            await webhookRepo.updateStatus(
              delivery.id,
              "failed",
              `HTTP ${response.status}: ${response.statusText}`,
            );
          }
        } catch (err) {
          await webhookRepo.updateStatus(
            delivery.id,
            "failed",
            err instanceof Error ? err.message : "Unknown error",
          );
        }
      }
    } catch {
      // Fire-and-forget: swallow top-level errors so the API response is not blocked
    }
  };

  // Use Next.js after() to keep the serverless function alive for background work
  after(work);
}
