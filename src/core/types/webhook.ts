import type { CompanyId } from "./company";

export type WebhookDeliveryId = string & { readonly __brand: "WebhookDeliveryId" };

export type DeliveryStatus = "pending" | "processing" | "succeeded" | "failed";

export interface WebhookDelivery {
  id: WebhookDeliveryId;
  company_id: CompanyId;
  idempotency_key: string;
  source: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: DeliveryStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  processed_at: string | null;
}
