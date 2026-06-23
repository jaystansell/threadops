/**
 * Integration test: verify two accounts (companies) cannot see each other's data.
 *
 * This test creates two temporary companies with their own API keys,
 * creates threads via each key, and asserts that GET /api/threads
 * only returns threads belonging to the calling key's company.
 *
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { generatePlaintextKey, extractPrefix, hashKey } from "@/core/rules/api-key";

const HAS_ENV =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

const BASE_URL = process.env.TEST_BASE_URL ?? "https://threadzy.ai";

interface TestAccount {
  companyId: string;
  apiKeyId: string;
  plaintextKey: string;
  threadIds: string[];
}

let admin: SupabaseClient;
let accountA: TestAccount;
let accountB: TestAccount;

async function createTestAccount(
  db: SupabaseClient,
  companyName: string,
  agentLabel: string,
): Promise<TestAccount> {
  // Create company (random suffix to avoid unique constraint on reruns)
  const slug = `${companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
  const { data: company, error: companyErr } = await db
    .from("companies")
    .insert({ name: companyName, slug })
    .select("id")
    .single();
  if (companyErr) throw new Error(`Failed to create company: ${companyErr.message}`);

  // Create API key
  const plaintext = generatePlaintextKey();
  const prefix = extractPrefix(plaintext);
  const hash = await hashKey(plaintext);

  const { data: key, error: keyErr } = await db
    .from("api_keys")
    .insert({
      company_id: company.id,
      label: agentLabel,
      key_hash: hash,
      key_prefix: prefix,
      scopes: [],
    })
    .select("id")
    .single();
  if (keyErr) throw new Error(`Failed to create API key: ${keyErr.message}`);

  return {
    companyId: company.id,
    apiKeyId: key.id,
    plaintextKey: plaintext,
    threadIds: [],
  };
}

async function createThread(
  baseUrl: string,
  apiKey: string,
  title: string,
  companyId: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/api/threads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      title,
      company_id: companyId,
      message_body: `Test message for ${title}`,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`POST /api/threads failed (${res.status}): ${body}`);
  }
  const thread = await res.json();
  return thread.id;
}

async function getThreads(
  baseUrl: string,
  apiKey: string,
): Promise<Array<{ id: string; company_id: string; title: string }>> {
  const res = await fetch(`${baseUrl}/api/threads?status=all&limit=200`, {
    headers: { "X-API-Key": apiKey },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET /api/threads failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function getWebhookEndpoints(
  baseUrl: string,
  apiKey: string,
): Promise<Array<{ id: string; company_id: string }>> {
  const res = await fetch(`${baseUrl}/api/webhook-endpoints`, {
    headers: { "X-API-Key": apiKey },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET /api/webhook-endpoints failed (${res.status}): ${body}`);
  }
  return res.json();
}

const describeIfEnv = HAS_ENV ? describe : describe.skip;

describeIfEnv("User Isolation — two accounts cannot see each other's data", () => {
  beforeAll(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    admin = createClient(supabaseUrl, serviceKey);

    // Create two isolated test accounts
    accountA = await createTestAccount(admin, "IsolationTest-A", "Agent-A");
    accountB = await createTestAccount(admin, "IsolationTest-B", "Agent-B");

    // Create threads for each account
    const threadA1 = await createThread(BASE_URL, accountA.plaintextKey, "Account A Thread 1", accountA.companyId);
    const threadA2 = await createThread(BASE_URL, accountA.plaintextKey, "Account A Thread 2", accountA.companyId);
    accountA.threadIds.push(threadA1, threadA2);

    const threadB1 = await createThread(BASE_URL, accountB.plaintextKey, "Account B Thread 1", accountB.companyId);
    const threadB2 = await createThread(BASE_URL, accountB.plaintextKey, "Account B Thread 2", accountB.companyId);
    const threadB3 = await createThread(BASE_URL, accountB.plaintextKey, "Account B Thread 3", accountB.companyId);
    accountB.threadIds.push(threadB1, threadB2, threadB3);
  }, 30000);

  afterAll(async () => {
    if (!admin) return;
    // Clean up test data in reverse order (messages → threads → api_keys → companies)
    for (const account of [accountA, accountB]) {
      if (!account) continue;
      for (const tid of account.threadIds) {
        await admin.from("messages").delete().eq("thread_id", tid);
        await admin.from("thread_tags").delete().eq("thread_id", tid);
        await admin.from("threads").delete().eq("id", tid);
      }
      await admin.from("api_keys").delete().eq("id", account.apiKeyId);
      await admin.from("companies").delete().eq("id", account.companyId);
    }
  }, 15000);

  it("Account A only sees its own threads", async () => {
    const threads = await getThreads(BASE_URL, accountA.plaintextKey);

    expect(threads.length).toBe(2);
    const ids = threads.map((t) => t.id);
    expect(ids).toContain(accountA.threadIds[0]);
    expect(ids).toContain(accountA.threadIds[1]);

    // Must NOT contain any of Account B's threads
    for (const bId of accountB.threadIds) {
      expect(ids).not.toContain(bId);
    }

    // Every thread must belong to Account A's company
    for (const t of threads) {
      expect(t.company_id).toBe(accountA.companyId);
    }
  });

  it("Account B only sees its own threads", async () => {
    const threads = await getThreads(BASE_URL, accountB.plaintextKey);

    expect(threads.length).toBe(3);
    const ids = threads.map((t) => t.id);
    expect(ids).toContain(accountB.threadIds[0]);
    expect(ids).toContain(accountB.threadIds[1]);
    expect(ids).toContain(accountB.threadIds[2]);

    // Must NOT contain any of Account A's threads
    for (const aId of accountA.threadIds) {
      expect(ids).not.toContain(aId);
    }

    // Every thread must belong to Account B's company
    for (const t of threads) {
      expect(t.company_id).toBe(accountB.companyId);
    }
  });

  it("Account A cannot read Account B's thread by ID", async () => {
    const targetThreadId = accountB.threadIds[0];
    const res = await fetch(`${BASE_URL}/api/threads/${targetThreadId}`, {
      headers: { "X-API-Key": accountA.plaintextKey },
    });
    // Should either 404 or return empty / error — not the thread data
    if (res.ok) {
      const data = await res.json();
      // If it returns something, it must NOT be the other account's thread
      expect(data.company_id).not.toBe(accountB.companyId);
    } else {
      expect([403, 404]).toContain(res.status);
    }
  });

  it("Account B cannot read Account A's thread by ID", async () => {
    const targetThreadId = accountA.threadIds[0];
    const res = await fetch(`${BASE_URL}/api/threads/${targetThreadId}`, {
      headers: { "X-API-Key": accountB.plaintextKey },
    });
    if (res.ok) {
      const data = await res.json();
      expect(data.company_id).not.toBe(accountA.companyId);
    } else {
      expect([403, 404]).toContain(res.status);
    }
  });

  it("Account A cannot post messages to Account B's thread", async () => {
    const targetThreadId = accountB.threadIds[0];
    const res = await fetch(`${BASE_URL}/api/threads/${targetThreadId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": accountA.plaintextKey,
      },
      body: JSON.stringify({ body: "Sneaky cross-account message" }),
    });
    // Should be rejected
    expect(res.ok).toBe(false);
    expect([401, 403, 404]).toContain(res.status);
  });

  it("Account B cannot post messages to Account A's thread", async () => {
    const targetThreadId = accountA.threadIds[0];
    const res = await fetch(`${BASE_URL}/api/threads/${targetThreadId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": accountB.plaintextKey,
      },
      body: JSON.stringify({ body: "Sneaky cross-account message" }),
    });
    expect(res.ok).toBe(false);
    expect([401, 403, 404]).toContain(res.status);
  });

  it("Account A's webhook endpoints are not visible to Account B", async () => {
    // Register a webhook for Account A
    const registerRes = await fetch(`${BASE_URL}/api/webhook-endpoints`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": accountA.plaintextKey,
      },
      body: JSON.stringify({
        url: "https://example.com/webhook-a",
        events: ["message.created"],
      }),
    });

    let webhookIdToCleanup: string | null = null;
    if (registerRes.ok) {
      const webhook = await registerRes.json();
      webhookIdToCleanup = webhook.id;

      // Account B should NOT see Account A's webhook
      const bEndpoints = await getWebhookEndpoints(BASE_URL, accountB.plaintextKey);
      const bIds = bEndpoints.map((e) => e.id);
      expect(bIds).not.toContain(webhook.id);

      // Clean up webhook
      if (webhookIdToCleanup) {
        await admin.from("webhook_endpoints").delete().eq("id", webhookIdToCleanup);
      }
    }
  });

  it("Invalid API key returns 401", async () => {
    const res = await fetch(`${BASE_URL}/api/threads`, {
      headers: { "X-API-Key": "to_fake_key_that_does_not_exist" },
    });
    expect(res.status).toBe(401);
  });
});
