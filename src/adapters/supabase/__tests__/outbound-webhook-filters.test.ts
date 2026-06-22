/**
 * Tests for author_kind filter in outbound webhook dispatch.
 *
 * Scenarios covered:
 * 1. Multi-agent filter isolation (agent A with filter, agent B without)
 * 2. Cross-agent data bleed (agent-scoped delivery still enforced)
 * 3. Echo suppression + filter interaction (both mechanisms together)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the filtering logic extracted from dispatchOutboundWebhooks.
// The function itself uses after() and internal DB clients, so we test
// the filter predicate logic directly.

import type { WebhookEndpoint } from "@/core/types/webhook-endpoint";
import type { CompanyId } from "@/core/types";

function makeEndpoint(overrides: Partial<WebhookEndpoint>): WebhookEndpoint {
  return {
    id: "ep_default" as WebhookEndpoint["id"],
    company_id: "company_1" as CompanyId,
    api_key_id: null,
    url: "https://example.com/hook",
    events: ["message.created"],
    secret: "secret123",
    active: true,
    filters: {},
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * Replicates the filtering logic from dispatchOutboundWebhooks:
 * 1. Agent-scoped delivery + echo suppression
 * 2. Author-kind filter
 */
function filterEndpoints(
  allEndpoints: WebhookEndpoint[],
  eventType: string,
  eventPayload: Record<string, unknown>,
  agentApiKeyId?: string | null,
  excludeApiKeyId?: string | null,
): WebhookEndpoint[] {
  // Step 1: Agent-scoped delivery + echo suppression (from existing code)
  const endpoints = eventType === "docs.updated"
    ? allEndpoints
    : allEndpoints.filter((ep) => {
        if (excludeApiKeyId && ep.api_key_id === excludeApiKeyId) return false;
        if (!agentApiKeyId) {
          return !ep.api_key_id;
        }
        return ep.api_key_id === agentApiKeyId;
      });

  // Step 2: Author-kind filter (new logic)
  const filtered = endpoints.filter((ep) => {
    const authorKindFilter = ep.filters?.author_kind;
    if (!authorKindFilter) return true;
    return eventPayload.author_kind === authorKindFilter;
  });

  return filtered;
}

describe("outbound webhook author_kind filter", () => {
  describe("Scenario 1: Multi-agent filter isolation", () => {
    const agentAEndpoint = makeEndpoint({
      id: "ep_agent_a" as WebhookEndpoint["id"],
      api_key_id: "key_agent_a",
      url: "https://agent-a.example.com/hook",
      filters: { author_kind: "user" },
    });

    const agentBEndpoint = makeEndpoint({
      id: "ep_agent_b" as WebhookEndpoint["id"],
      api_key_id: "key_agent_b",
      url: "https://agent-b.example.com/hook",
      filters: {},
    });

    it("delivers human message to Agent A (matches filter) when thread owned by A", () => {
      const result = filterEndpoints(
        [agentAEndpoint, agentBEndpoint],
        "message.created",
        { author_kind: "user", body: "Hello from human" },
        "key_agent_a", // thread owned by agent A
        null,
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("ep_agent_a");
    });

    it("delivers human message to Agent B (no filter) when thread owned by B", () => {
      const result = filterEndpoints(
        [agentAEndpoint, agentBEndpoint],
        "message.created",
        { author_kind: "user", body: "Hello from human" },
        "key_agent_b", // thread owned by agent B
        null,
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("ep_agent_b");
    });

    it("does NOT deliver agent message to Agent A (filtered out by author_kind=user)", () => {
      const result = filterEndpoints(
        [agentAEndpoint, agentBEndpoint],
        "message.created",
        { author_kind: "agent", body: "Agent reply" },
        "key_agent_a", // thread owned by agent A
        null,
      );
      expect(result).toHaveLength(0);
    });

    it("DOES deliver agent message to Agent B (no filter)", () => {
      const result = filterEndpoints(
        [agentAEndpoint, agentBEndpoint],
        "message.created",
        { author_kind: "agent", body: "Agent reply" },
        "key_agent_b", // thread owned by agent B
        null,
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("ep_agent_b");
    });
  });

  describe("Scenario 2: Cross-agent data bleed prevention", () => {
    const agentAEndpoint = makeEndpoint({
      id: "ep_agent_a" as WebhookEndpoint["id"],
      api_key_id: "key_agent_a",
      url: "https://agent-a.example.com/hook",
      filters: { author_kind: "user" },
    });

    const agentBEndpoint = makeEndpoint({
      id: "ep_agent_b" as WebhookEndpoint["id"],
      api_key_id: "key_agent_b",
      url: "https://agent-b.example.com/hook",
      filters: {},
    });

    it("Agent A endpoint never receives events from Agent B's threads", () => {
      // Thread owned by Agent B — Agent A's endpoint should NOT receive
      const result = filterEndpoints(
        [agentAEndpoint, agentBEndpoint],
        "message.created",
        { author_kind: "user", body: "Hello" },
        "key_agent_b", // thread owned by B
        null,
      );
      // Only agent B's endpoint should receive (agent-scoped delivery)
      expect(result.map((ep) => ep.id)).not.toContain("ep_agent_a");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("ep_agent_b");
    });

    it("Agent B endpoint never receives events from Agent A's threads", () => {
      const result = filterEndpoints(
        [agentAEndpoint, agentBEndpoint],
        "message.created",
        { author_kind: "user", body: "Hello" },
        "key_agent_a", // thread owned by A
        null,
      );
      expect(result.map((ep) => ep.id)).not.toContain("ep_agent_b");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("ep_agent_a");
    });

    it("filter does not bypass agent-scoped delivery", () => {
      // Even if agent B has no filter, it still can't see agent A's threads
      const agentBNoFilter = makeEndpoint({
        id: "ep_agent_b" as WebhookEndpoint["id"],
        api_key_id: "key_agent_b",
        filters: {}, // no filter — accepts all author_kinds
      });
      const result = filterEndpoints(
        [agentAEndpoint, agentBNoFilter],
        "message.created",
        { author_kind: "agent", body: "Agent A talking" },
        "key_agent_a", // thread owned by A
        null,
      );
      // Only agent A's endpoint should be considered, but it filters to user only
      expect(result).toHaveLength(0);
    });
  });

  describe("Scenario 3: Echo suppression + filter interaction", () => {
    it("Agent A posts in own thread with filter=user: ZERO deliveries", () => {
      const agentAEndpoint = makeEndpoint({
        id: "ep_agent_a" as WebhookEndpoint["id"],
        api_key_id: "key_agent_a",
        url: "https://agent-a.example.com/hook",
        filters: { author_kind: "user" },
      });

      // Agent A posts a message in its own thread
      // excludeApiKeyId = key_agent_a (echo suppression: sender excluded)
      // agentApiKeyId = key_agent_a (thread owned by A)
      const result = filterEndpoints(
        [agentAEndpoint],
        "message.created",
        { author_kind: "agent", body: "Agent A reply" },
        "key_agent_a", // thread owner
        "key_agent_a", // exclude sender (echo suppression)
      );
      // Echo suppression removes agent A's endpoint, then nothing left
      expect(result).toHaveLength(0);
    });

    it("Even without echo suppression, filter=user blocks agent messages", () => {
      const agentAEndpoint = makeEndpoint({
        id: "ep_agent_a" as WebhookEndpoint["id"],
        api_key_id: "key_agent_a",
        url: "https://agent-a.example.com/hook",
        filters: { author_kind: "user" },
      });

      // Simulate: another agent posts in A's thread (no echo suppression for A)
      const result = filterEndpoints(
        [agentAEndpoint],
        "message.created",
        { author_kind: "agent", body: "Different agent message" },
        "key_agent_a", // thread owned by A
        "key_other_agent", // echo suppression for someone else
      );
      // Agent A's endpoint passes agent-scoped check but fails author_kind filter
      expect(result).toHaveLength(0);
    });

    it("Human posts in Agent A's thread with filter=user: delivers correctly", () => {
      const agentAEndpoint = makeEndpoint({
        id: "ep_agent_a" as WebhookEndpoint["id"],
        api_key_id: "key_agent_a",
        url: "https://agent-a.example.com/hook",
        filters: { author_kind: "user" },
      });

      const result = filterEndpoints(
        [agentAEndpoint],
        "message.created",
        { author_kind: "user", body: "Hello from human" },
        "key_agent_a", // thread owned by A
        null, // no echo suppression (human posted)
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("ep_agent_a");
    });
  });

  describe("Edge cases", () => {
    it("filter=agent passes only agent messages", () => {
      const endpoint = makeEndpoint({
        id: "ep_1" as WebhookEndpoint["id"],
        api_key_id: "key_1",
        filters: { author_kind: "agent" },
      });

      const agentResult = filterEndpoints(
        [endpoint],
        "message.created",
        { author_kind: "agent" },
        "key_1",
        null,
      );
      expect(agentResult).toHaveLength(1);

      const userResult = filterEndpoints(
        [endpoint],
        "message.created",
        { author_kind: "user" },
        "key_1",
        null,
      );
      expect(userResult).toHaveLength(0);
    });

    it("no filter passes all messages", () => {
      const endpoint = makeEndpoint({
        id: "ep_1" as WebhookEndpoint["id"],
        api_key_id: "key_1",
        filters: {},
      });

      for (const kind of ["user", "agent"]) {
        const result = filterEndpoints(
          [endpoint],
          "message.created",
          { author_kind: kind },
          "key_1",
          null,
        );
        expect(result).toHaveLength(1);
      }
    });

    it("docs.updated events bypass agent-scoped delivery but still apply author_kind filter", () => {
      const endpoint = makeEndpoint({
        id: "ep_1" as WebhookEndpoint["id"],
        api_key_id: "key_1",
        filters: { author_kind: "user" },
      });

      const result = filterEndpoints(
        [endpoint],
        "docs.updated",
        { author_kind: "agent" },
        "key_2", // different agent's thread
        null,
      );
      // docs.updated skips agent-scoped check but author_kind filter still applies
      expect(result).toHaveLength(0);
    });

    it("docs.updated with matching author_kind filter passes", () => {
      const endpoint = makeEndpoint({
        id: "ep_1" as WebhookEndpoint["id"],
        api_key_id: "key_1",
        filters: { author_kind: "user" },
      });

      const result = filterEndpoints(
        [endpoint],
        "docs.updated",
        { author_kind: "user" },
        "key_2",
        null,
      );
      expect(result).toHaveLength(1);
    });
  });
});
