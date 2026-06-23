import type {
  WebhookEndpoint,
  WebhookEndpointId,
  WebhookEventType,
  CompanyId,
} from "@/core/types";
import { ALWAYS_ON_EVENTS } from "@/core/types";
import type {
  WebhookEndpointRepo,
  WebhookEndpointCreateInput,
  WebhookEndpointUpdateInput,
} from "@/core/ports";
import type { SupabaseClient } from "./client";

export function createWebhookEndpointRepo(
  db: SupabaseClient,
): WebhookEndpointRepo {
  return {
    async listByCompany(companyId: CompanyId): Promise<WebhookEndpoint[]> {
      const { data, error } = await db
        .from("webhook_endpoints")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as WebhookEndpoint[];
    },

    async getById(
      companyId: CompanyId,
      id: WebhookEndpointId,
    ): Promise<WebhookEndpoint | null> {
      const { data, error } = await db
        .from("webhook_endpoints")
        .select("*")
        .eq("company_id", companyId)
        .eq("id", id)
        .single();
      if (error && error.code === "PGRST116") return null;
      if (error) throw error;
      return data as WebhookEndpoint;
    },

    async create(
      input: WebhookEndpointCreateInput,
    ): Promise<WebhookEndpoint> {
      const row: Record<string, unknown> = {
        company_id: input.company_id,
        url: input.url,
        events: input.events,
        secret: input.secret,
      };
      if (input.api_key_id) row.api_key_id = input.api_key_id;
      if (input.filters) row.filters = input.filters;
      if (input.include_context !== undefined) row.include_context = input.include_context;

      const { data, error } = await db
        .from("webhook_endpoints")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data as WebhookEndpoint;
    },

    async update(
      companyId: CompanyId,
      id: WebhookEndpointId,
      input: WebhookEndpointUpdateInput,
    ): Promise<WebhookEndpoint> {
      const update: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (input.url !== undefined) update.url = input.url;
      if (input.events !== undefined) update.events = input.events;
      if (input.active !== undefined) update.active = input.active;
      if (input.filters !== undefined) update.filters = input.filters;
      if (input.include_context !== undefined) update.include_context = input.include_context;

      const { data, error } = await db
        .from("webhook_endpoints")
        .update(update)
        .eq("company_id", companyId)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as WebhookEndpoint;
    },

    async remove(
      companyId: CompanyId,
      id: WebhookEndpointId,
    ): Promise<void> {
      const { error } = await db
        .from("webhook_endpoints")
        .delete()
        .eq("company_id", companyId)
        .eq("id", id);
      if (error) throw error;
    },

    async listActiveForEvent(
      companyId: CompanyId,
      eventType: string,
    ): Promise<WebhookEndpoint[]> {
      let query = db
        .from("webhook_endpoints")
        .select("*")
        .eq("company_id", companyId)
        .eq("active", true);

      // Always-on events are delivered to ALL active endpoints, even if the
      // endpoint's stored events array doesn't include them (e.g., endpoints
      // created before the event type was added to ALWAYS_ON_EVENTS).
      const isAlwaysOn = ALWAYS_ON_EVENTS.includes(
        eventType as WebhookEventType,
      );
      if (!isAlwaysOn) {
        query = query.contains("events", [eventType]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as WebhookEndpoint[];
    },
  };
}
