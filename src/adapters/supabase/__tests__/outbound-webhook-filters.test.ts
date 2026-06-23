/**
 * Tests for author_kind filter in outbound webhook dispatch.
 *
 * Scenarios covered:
 * 1. Multi-agent filter isolation (agent A with filter, agent B without)
 * 2. Cross-agent data bleed (agent-scoped delivery still enforced)
 * 3. Echo suppression + filter interaction (both mechanisms together)
 */
import { describe, it, expect } from "vitest";

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
    include_context: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * Replicates the filtering logic from dispatchOutboundWebhooks:
 * 1. Revoked key exclusion
 * 2. Agent-scoped delivery + echo suppression
 * 3. Author-kind filter
 */
function filterEndpoints(
  allEndpoints: WebhookEndpoint[],
  eventType: string,
  eventPayload: Record<string, unknown>,
  agentApiKeyId?: string | null,
  excludeApiKeyId?: string | null,
  revokedKeyIds?: Set<string>,
): WebhookEndpoint[] {
  // Step 0: Skip endpoints whose API key has been revoked
  const activeEndpoints = revokedKeyIds
    ? allEndpoints.filter((ep) => !ep.api_key_id || !revokedKeyIds.has(ep.api_key_id))
    : allEndpoints;

  // Step 1: Agent-scoped delivery + echo suppression (from existing code)
  const endpoints = eventType === "docs.updated"
    ? activeEndpoints
    : activeEndpoints.filter((ep) => {
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

  describe("Scenario 4: Revoked agent endpoints", () => {
    const activeAgentEndpoint = makeEndpoint({
      id: "ep_active" as WebhookEndpoint["id"],
      api_key_id: "key_active",
      url: "https://active-agent.example.com/hook",
      filters: {},
    });

    const revokedAgentEndpoint = makeEndpoint({
      id: "ep_revoked" as WebhookEndpoint["id"],
      api_key_id: "key_revoked",
      url: "https://revoked-agent.example.com/hook",
      filters: {},
    });

    const revokedKeys = new Set(["key_revoked"]);

    it("revoked agent endpoint receives ZERO deliveries for its own thread", () => {
      const result = filterEndpoints(
        [revokedAgentEndpoint],
        "message.created",
        { author_kind: "user", body: "Hello" },
        "key_revoked",
        null,
        revokedKeys,
      );
      expect(result).toHaveLength(0);
    });

    it("active agent still receives deliveries when a revoked agent exists", () => {
      const result = filterEndpoints(
        [activeAgentEndpoint, revokedAgentEndpoint],
        "message.created",
        { author_kind: "user", body: "Hello" },
        "key_active",
        null,
        revokedKeys,
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("ep_active");
    });

    it("revoked agent excluded from docs.updated broadcast too", () => {
      const result = filterEndpoints(
        [activeAgentEndpoint, revokedAgentEndpoint],
        "docs.updated",
        { author_kind: "user" },
        null,
        null,
        revokedKeys,
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("ep_active");
    });

    it("legacy endpoint (no api_key_id) unaffected by revoked keys", () => {
      const legacyEndpoint = makeEndpoint({
        id: "ep_legacy" as WebhookEndpoint["id"],
        api_key_id: null,
        url: "https://legacy.example.com/hook",
      });
      const result = filterEndpoints(
        [legacyEndpoint, revokedAgentEndpoint],
        "docs.updated",
        { author_kind: "user" },
        null,
        null,
        revokedKeys,
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("ep_legacy");
    });
  });

  describe("Scenario 5: Multi-company isolation", () => {
    const company1Endpoint = makeEndpoint({
      id: "ep_c1" as WebhookEndpoint["id"],
      company_id: "company_1" as CompanyId,
      api_key_id: "key_c1_agent",
      url: "https://company1.example.com/hook",
    });

    const company2Endpoint = makeEndpoint({
      id: "ep_c2" as WebhookEndpoint["id"],
      company_id: "company_2" as CompanyId,
      api_key_id: "key_c2_agent",
      url: "https://company2.example.com/hook",
    });

    it("company 1 events never reach company 2 endpoints (agent-scoped)", () => {
      // company_id filtering happens at DB query level (listActiveForEvent).
      // Here we verify that even if both endpoints were returned (hypothetical
      // bug), agent-scoped delivery prevents cross-company bleed.
      const result = filterEndpoints(
        [company1Endpoint, company2Endpoint],
        "message.created",
        { author_kind: "user", body: "Company 1 message" },
        "key_c1_agent", // thread owned by company 1's agent
        null,
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("ep_c1");
      expect(result[0].company_id).toBe("company_1");
    });

    it("company 2 events never reach company 1 endpoints (agent-scoped)", () => {
      const result = filterEndpoints(
        [company1Endpoint, company2Endpoint],
        "message.created",
        { author_kind: "user", body: "Company 2 message" },
        "key_c2_agent",
        null,
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("ep_c2");
      expect(result[0].company_id).toBe("company_2");
    });

    it("docs.updated goes to all endpoints regardless of company (since DB filters by company_id)", () => {
      // docs.updated bypasses agent-scoped delivery. In production, listActiveForEvent
      // already filters by company_id. This test documents that behavior.
      const result = filterEndpoints(
        [company1Endpoint, company2Endpoint],
        "docs.updated",
        { author_kind: "user" },
        null,
        null,
      );
      // Both pass because docs.updated skips agent-scoped check.
      // In production, only same-company endpoints would be in the list.
      expect(result).toHaveLength(2);
    });
  });

  describe("Scenario 6: Combined revoked + filter + echo suppression", () => {
    it("all three mechanisms stack correctly", () => {
      const activeFiltered = makeEndpoint({
        id: "ep_af" as WebhookEndpoint["id"],
        api_key_id: "key_active_filtered",
        filters: { author_kind: "user" },
      });
      const activeUnfiltered = makeEndpoint({
        id: "ep_au" as WebhookEndpoint["id"],
        api_key_id: "key_active_unfiltered",
        filters: {},
      });
      const revokedEndpoint = makeEndpoint({
        id: "ep_revoked" as WebhookEndpoint["id"],
        api_key_id: "key_revoked",
        filters: {},
      });
      const echoEndpoint = makeEndpoint({
        id: "ep_echo" as WebhookEndpoint["id"],
        api_key_id: "key_active_filtered",
        filters: {},
      });

      const revokedKeys = new Set(["key_revoked"]);

      // Agent "key_active_filtered" posts in its own thread
      // - revokedEndpoint: excluded (revoked key)
      // - echoEndpoint: excluded (echo suppression, same key as sender)
      // - activeFiltered: excluded (echo suppression, same key as sender)
      // - activeUnfiltered: excluded (agent-scoped, different key)
      const result = filterEndpoints(
        [activeFiltered, activeUnfiltered, revokedEndpoint, echoEndpoint],
        "message.created",
        { author_kind: "agent", body: "Agent reply" },
        "key_active_filtered", // thread owner
        "key_active_filtered", // sender (echo suppression)
        revokedKeys,
      );
      expect(result).toHaveLength(0);
    });

    it("human posts in active agent thread: only matching active endpoint receives", () => {
      const activeFiltered = makeEndpoint({
        id: "ep_af" as WebhookEndpoint["id"],
        api_key_id: "key_agent",
        filters: { author_kind: "user" },
      });
      const revokedEndpoint = makeEndpoint({
        id: "ep_revoked" as WebhookEndpoint["id"],
        api_key_id: "key_revoked",
        filters: {},
      });

      const revokedKeys = new Set(["key_revoked"]);

      const result = filterEndpoints(
        [activeFiltered, revokedEndpoint],
        "message.created",
        { author_kind: "user", body: "Human message" },
        "key_agent",
        null,
        revokedKeys,
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("ep_af");
    });
  });
});
