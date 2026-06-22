import type {
  WebhookEndpoint,
  WebhookEndpointFilters,
  WebhookEndpointId,
} from "../types/webhook-endpoint";
import type { CompanyId } from "../types";

export interface WebhookEndpointRepo {
  listByCompany(companyId: CompanyId): Promise<WebhookEndpoint[]>;
  getById(
    companyId: CompanyId,
    id: WebhookEndpointId,
  ): Promise<WebhookEndpoint | null>;
  create(input: WebhookEndpointCreateInput): Promise<WebhookEndpoint>;
  update(
    companyId: CompanyId,
    id: WebhookEndpointId,
    input: WebhookEndpointUpdateInput,
  ): Promise<WebhookEndpoint>;
  remove(companyId: CompanyId, id: WebhookEndpointId): Promise<void>;
  listActiveForEvent(
    companyId: CompanyId,
    eventType: string,
  ): Promise<WebhookEndpoint[]>;
}

export interface WebhookEndpointCreateInput {
  company_id: CompanyId;
  api_key_id?: string | null;
  url: string;
  events: string[];
  secret: string;
  filters?: WebhookEndpointFilters;
}

export interface WebhookEndpointUpdateInput {
  url?: string;
  events?: string[];
  active?: boolean;
  filters?: WebhookEndpointFilters;
}
