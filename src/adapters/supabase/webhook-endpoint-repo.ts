import type { SupabaseClient } from "./client";
import type {
  WebhookEndpoint,
  WebhookEndpointId,
  CompanyId,
} from "@/core/types";
import type {
  WebhookEndpointRepo,
  WebhookEndpointCreateInput,
  WebhookEndpointUpdateInput,
} from "@/core/ports";

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
      const { data, error } = await db
        .from("webhook_endpoints")
        .insert({
          company_id: input.company_id,
          url: input.url,
          events: input.events,
          secret: input.secret,
        })
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
      const { data, error } = await db
        .from("webhook_endpoints")
        .select("*")
        .eq("company_id", companyId)
        .eq("active", true)
        .contains("events", [eventType]);
      if (error) throw error;
      return data as WebhookEndpoint[];
    },
  };
}
