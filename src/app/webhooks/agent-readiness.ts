import type { ApiKey, WebhookDelivery, WebhookEndpoint } from "@/core/types";
import { calculateWebhookHealth, type WebhookHealth } from "@/mcp/tools/webhook-health";

const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type ReadinessTone = "green" | "yellow" | "red" | "grey";

export interface ReadinessIndicator {
  tone: ReadinessTone;
  label: string;
  explanation: string;
}

export interface AgentReadiness {
  api: ReadinessIndicator;
  delivery: ReadinessIndicator;
  handler: ReadinessIndicator;
  endpointHealth: WebhookHealth[];
}

export function buildAgentReadiness(
  apiKey: ApiKey,
  endpoints: WebhookEndpoint[],
  deliveries: WebhookDelivery[],
  processingStatuses: Array<{ thread_id: string; api_key_id: string; created_at: string }>,
  agentMessages: Array<{ thread_id: string; author_id: string; created_at: string }>,
): AgentReadiness {
  const recentCutoff = Date.now() - RECENT_WINDOW_MS;
  const endpointHealth = calculateWebhookHealth(endpoints, deliveries);
  const lastUsedAt = apiKey.last_used_at ? new Date(apiKey.last_used_at).getTime() : null;
  const api: ReadinessIndicator = lastUsedAt === null
    ? {
        tone: "grey",
        label: "Not yet used",
        explanation: "This API key has not authenticated yet. MCP or REST access has not been exercised.",
      }
    : lastUsedAt >= recentCutoff
      ? {
          tone: "green",
          label: "Ready",
          explanation: "This agent authenticated with Threadzy in the last 7 days.",
        }
      : {
          tone: "red",
          label: "Stale",
          explanation: "This agent has not authenticated with Threadzy in the last 7 days.",
        };

  const activeEndpoints = endpoints.filter((endpoint) => endpoint.active);
  const activeEndpointIds = new Set<string>(activeEndpoints.map((endpoint) => endpoint.id));
  const recentSuccessfulDelivery = deliveries.some(
    (delivery) =>
      delivery.endpoint_id !== null
      && activeEndpointIds.has(delivery.endpoint_id)
      && delivery.status === "succeeded"
      && new Date(delivery.created_at).getTime() >= recentCutoff,
  );
  const delivery: ReadinessIndicator = activeEndpoints.length === 0
    ? {
        tone: "red",
        label: "No active endpoint",
        explanation: "We have nowhere to deliver events. Register a webhook endpoint.",
      }
    : recentSuccessfulDelivery
      ? {
          tone: "green",
          label: "Delivering",
          explanation: "An active endpoint accepted a webhook in the last 7 days.",
        }
      : {
          tone: "yellow",
          label: "Not recently confirmed",
          explanation: "Active endpoints exist, but none has returned a successful delivery in the last 7 days.",
        };

  const recentMessageDeliveries = deliveries.filter(
    (delivery) =>
      delivery.endpoint_id !== null
      && activeEndpointIds.has(delivery.endpoint_id)
      && delivery.event_type === "message.created"
      && delivery.status === "succeeded"
      && new Date(delivery.created_at).getTime() >= recentCutoff,
  );
  const acted = recentMessageDeliveries.some((delivery) => {
    const threadId = delivery.payload.thread_id;
    if (typeof threadId !== "string") return false;
    return processingStatuses.some(
      (status) =>
        status.api_key_id === apiKey.id
        && status.thread_id === threadId
        && new Date(status.created_at).getTime() >= new Date(delivery.created_at).getTime(),
    ) || agentMessages.some(
      (message) =>
        message.author_id === apiKey.id
        && message.thread_id === threadId
        && new Date(message.created_at).getTime() >= new Date(delivery.created_at).getTime(),
    );
  });
  const handler: ReadinessIndicator = recentMessageDeliveries.length === 0
    ? {
        tone: "grey",
        label: "Not exercised",
        explanation: "No successful message event has reached this agent recently.",
      }
    : acted
      ? {
          tone: "green",
          label: "Acting",
          explanation: "A delivered message was followed by an ACK or an agent reply.",
        }
      : {
          tone: "yellow",
          label: "No handler response",
          explanation: "Events were delivered, but this agent has not ACKed or replied. MCP access alone does not make an agent respond. A persistent webhook handler must invoke the agent.",
        };

  return { api, delivery, handler, endpointHealth };
}
