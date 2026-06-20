import type { SupabaseClient } from "./client";
import type {
  WebhookDelivery,
  WebhookDeliveryId,
  DeliveryStatus,
  CompanyId,
} from "@/core/types";
import type { WebhookRepo, WebhookDeliveryCreateInput } from "@/core/ports";

export function createWebhookRepo(db: SupabaseClient): WebhookRepo {
  return {
    async findByIdempotencyKey(
      companyId: CompanyId,
      idempotencyKey: string,
    ): Promise<WebhookDelivery | null> {
      const { data, error } = await db
        .from("webhook_deliveries")
        .select("*")
        .eq("company_id", companyId)
        .eq("idempotency_key", idempotencyKey)
        .single();
      if (error && error.code === "PGRST116") return null;
      if (error) throw error;
      return data as WebhookDelivery;
    },

    async create(
      input: WebhookDeliveryCreateInput,
    ): Promise<WebhookDelivery> {
      const { data, error } = await db
        .from("webhook_deliveries")
        .insert({
          company_id: input.company_id,
          idempotency_key: input.idempotency_key,
          source: input.source,
          event_type: input.event_type,
          payload: input.payload,
          status: "pending" as DeliveryStatus,
          attempts: 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data as WebhookDelivery;
    },

    async updateStatus(
      deliveryId: WebhookDeliveryId,
      status: DeliveryStatus,
      error?: string,
    ): Promise<WebhookDelivery> {
      const { data: current, error: fetchError } = await db
        .from("webhook_deliveries")
        .select("attempts")
        .eq("id", deliveryId)
        .single();
      if (fetchError) throw fetchError;

      const update: Record<string, unknown> = {
        status,
        attempts: (current.attempts as number) + 1,
      };
      if (status === "succeeded" || status === "failed") {
        update.processed_at = new Date().toISOString();
      }
      if (error) {
        update.last_error = error;
      }

      const { data, error: dbError } = await db
        .from("webhook_deliveries")
        .update(update)
        .eq("id", deliveryId)
        .select()
        .single();
      if (dbError) throw dbError;
      return data as WebhookDelivery;
    },

    async listByCompany(
      companyId: CompanyId,
      limit = 50,
    ): Promise<WebhookDelivery[]> {
      const { data, error } = await db
        .from("webhook_deliveries")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as WebhookDelivery[];
    },
  };
}
