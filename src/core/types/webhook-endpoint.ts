import type { CompanyId } from "./company";

export type WebhookEndpointId = string & {
  readonly __brand: "WebhookEndpointId";
};

export type WebhookEventType =
  | "message.created"
  | "thread.created"
  | "thread.status_changed"
  | "docs.updated";

export const WEBHOOK_EVENT_TYPES: WebhookEventType[] = [
  "message.created",
  "thread.created",
  "thread.status_changed",
  "docs.updated",
];

/** Scopes that are always included on every webhook endpoint. */
export const ALWAYS_ON_EVENTS: WebhookEventType[] = ["docs.updated"];

export interface WebhookEndpoint {
  id: WebhookEndpointId;
  company_id: CompanyId;
  api_key_id: string | null;
  url: string;
  events: WebhookEventType[];
  secret: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}
