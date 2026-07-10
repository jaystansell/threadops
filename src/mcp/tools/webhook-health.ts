import type { SupabaseClient } from "../../adapters/supabase/client";
import type { AuthContext } from "../auth";
import type { CompanyId, WebhookEndpoint } from "../../core/types";
import type { WebhookDelivery } from "../../core/types";
import { createWebhookEndpointRepo } from "../../adapters/supabase/webhook-endpoint-repo";
import { createWebhookRepo } from "../../adapters/supabase/webhook-repo";

export interface WebhookWarnings {
  duplicate_url: boolean;
  catch_all_filter: boolean;
  stale_no_recent_delivery: boolean;
  repeated_failures: boolean;
}

export interface WebhookHealth extends WebhookWarnings {
  endpoint_id: string;
  url: string;
  events: string[];
  filters: WebhookEndpoint["filters"];
  active: boolean;
  recent_delivery_successes: number;
  recent_delivery_failures: number;
  last_delivery_at: string | null;
}

export async function getWebhookHealth(
  db: SupabaseClient,
  auth: AuthContext,
): Promise<WebhookHealth[]> {
  const endpointRepo = createWebhookEndpointRepo(db);
  const webhookRepo = createWebhookRepo(db);
  const endpoints = await endpointRepo.listByAgent(auth.companyId as CompanyId, auth.keyId);
  const deliveries = await webhookRepo.listByEndpointIds(
    auth.companyId as CompanyId,
    endpoints.map((endpoint) => endpoint.id),
  );
  return calculateWebhookHealth(endpoints, deliveries);
}

export function calculateWebhookHealth(
  endpoints: WebhookEndpoint[],
  deliveries: WebhookDelivery[],
): WebhookHealth[] {
  const duplicateUrls = new Set(
    endpoints
      .map((endpoint) => endpoint.url)
      .filter((url, _, all) => all.indexOf(url) !== all.lastIndexOf(url)),
  );
  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return endpoints.map((endpoint) => {
    const endpointDeliveries = deliveries.filter(
      (delivery) => delivery.endpoint_id === endpoint.id,
    );
    const recentDeliveries = endpointDeliveries.filter(
      (delivery) => new Date(delivery.created_at).getTime() >= recentCutoff,
    );
    const successes = recentDeliveries.filter((delivery) => delivery.status === "succeeded");
    const failures = recentDeliveries.filter((delivery) => delivery.status === "failed");
    const lastDelivery = endpointDeliveries[0]?.created_at ?? null;
    const lastSuccess = successes[0]?.created_at;
    return {
      endpoint_id: endpoint.id,
      url: endpoint.url,
      events: endpoint.events,
      filters: endpoint.filters,
      active: endpoint.active,
      recent_delivery_successes: successes.length,
      recent_delivery_failures: failures.length,
      last_delivery_at: lastDelivery,
      duplicate_url: duplicateUrls.has(endpoint.url),
      catch_all_filter: endpoint.events.includes("message.created") && !endpoint.filters?.author_kind,
      stale_no_recent_delivery: !lastSuccess || new Date(lastSuccess).getTime() < recentCutoff,
      repeated_failures: failures.length >= 3 && failures.length > successes.length,
    };
  });
}

export function addWebhookWarnings<T extends WebhookEndpoint>(
  endpoints: T[],
  health: WebhookHealth[],
): Array<T & WebhookWarnings> {
  const byId = new Map(health.map((item) => [item.endpoint_id, item]));
  return endpoints.map((endpoint) => {
    const item = byId.get(endpoint.id);
    return {
      ...endpoint,
      duplicate_url: item?.duplicate_url ?? false,
      catch_all_filter: item?.catch_all_filter ?? false,
      stale_no_recent_delivery: item?.stale_no_recent_delivery ?? true,
      repeated_failures: item?.repeated_failures ?? false,
    };
  });
}
