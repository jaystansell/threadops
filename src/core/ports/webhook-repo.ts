import type { WebhookDelivery, WebhookDeliveryId, DeliveryStatus } from "../types";
import type { CompanyId } from "../types";

export interface WebhookRepo {
  findByIdempotencyKey(
    companyId: CompanyId,
    idempotencyKey: string,
  ): Promise<WebhookDelivery | null>;
  create(input: WebhookDeliveryCreateInput): Promise<WebhookDelivery>;
  updateStatus(
    deliveryId: WebhookDeliveryId,
    status: DeliveryStatus,
    error?: string,
  ): Promise<WebhookDelivery>;
  listByCompany(
    companyId: CompanyId,
    limit?: number,
  ): Promise<WebhookDelivery[]>;
  listByEndpointIds(
    companyId: CompanyId,
    endpointIds: string[],
    limit?: number,
  ): Promise<WebhookDelivery[]>;
}

export interface WebhookDeliveryCreateInput {
  company_id: CompanyId;
  endpoint_id?: string;
  idempotency_key: string;
  source: string;
  event_type: string;
  payload: Record<string, unknown>;
}
