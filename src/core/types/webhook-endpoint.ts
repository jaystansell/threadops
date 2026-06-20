import type { CompanyId } from "./company";

export type WebhookEndpointId = string & {
  readonly __brand: "WebhookEndpointId";
};

export type WebhookEventType =
  | "message.created"
  | "thread.created"
  | "thread.status_changed";

export const WEBHOOK_EVENT_TYPES: WebhookEventType[] = [
  "message.created",
  "thread.created",
  "thread.status_changed",
];

export interface WebhookEndpoint {
  id: WebhookEndpointId;
  company_id: CompanyId;
  url: string;
  events: WebhookEventType[];
  secret: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}
