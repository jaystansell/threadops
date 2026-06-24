import type { CompanyId } from "./company";

export type WebhookEndpointId = string & {
  readonly __brand: "WebhookEndpointId";
};

export type WebhookEventType =
  | "message.created"
  | "thread.created"
  | "thread.status_changed"
  | "thread.archived"
  | "thread.unhandled"
  | "docs.updated"
  | "action.requested"
  | "attachment.created";

export const WEBHOOK_EVENT_TYPES: WebhookEventType[] = [
  "message.created",
  "thread.created",
  "thread.status_changed",
  "thread.archived",
  "thread.unhandled",
  "docs.updated",
  "action.requested",
  "attachment.created",
];

/** Scopes that are always included on every webhook endpoint. */
export const ALWAYS_ON_EVENTS: WebhookEventType[] = ["docs.updated", "action.requested", "attachment.created", "thread.archived"];

export interface WebhookEndpointFilters {
  author_kind?: "user" | "agent";
}

export interface WebhookEndpoint {
  id: WebhookEndpointId;
  company_id: CompanyId;
  api_key_id: string | null;
  url: string;
  events: WebhookEventType[];
  secret: string;
  active: boolean;
  filters: WebhookEndpointFilters;
  include_context: boolean;
  ack_timeout_seconds: number;
  created_at: string;
  updated_at: string;
}
