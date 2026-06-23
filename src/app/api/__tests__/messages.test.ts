import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/adapters/supabase/client", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/adapters/supabase/message-repo", () => ({
  createMessageRepo: vi.fn(),
}));

vi.mock("@/adapters/supabase/api-key-repo", () => ({
  createApiKeyRepo: vi.fn(),
}));

vi.mock("@/adapters/supabase/auth/server", () => ({
  createAuthServerClient: vi.fn(),
}));

vi.mock("@/adapters/supabase/outbound-webhook", () => ({
  dispatchOutboundWebhooks: vi.fn(),
}));

vi.mock("@/core/rules/api-key", () => ({
  hashKey: vi.fn().mockResolvedValue("hashed-key"),
}));

import { createServerClient } from "@/adapters/supabase/client";
import { createMessageRepo } from "@/adapters/supabase/message-repo";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";

describe("POST /api/threads/[threadId]/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when neither API key nor session provided", async () => {
    vi.mocked(createAuthServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never);

    const req = new NextRequest(
      "http://localhost:3000/api/threads/00000000-0000-4000-8000-000000000001/messages",
      {
        method: "POST",
        body: JSON.stringify({ body: "Hello" }),
        headers: { "content-type": "application/json" },
      },
    );

    const { POST } = await import(
      "@/app/api/threads/[threadId]/messages/route"
    );
    const res = await POST(req, {
      params: Promise.resolve({ threadId: "00000000-0000-4000-8000-000000000001" }),
    } as never);

    expect(res.status).toBe(401);
  });

  it("returns 401 when API key is invalid", async () => {
    const mockApiKeyRepo = {
      lookupByHash: vi.fn().mockResolvedValue(null),
      touchLastUsed: vi.fn(),
    };

    vi.mocked(createServerClient).mockReturnValue({} as never);
    vi.mocked(createApiKeyRepo).mockReturnValue(mockApiKeyRepo as never);

    const req = new NextRequest(
      "http://localhost:3000/api/threads/00000000-0000-4000-8000-000000000001/messages",
      {
        method: "POST",
        body: JSON.stringify({ body: "Hello" }),
        headers: {
          "content-type": "application/json",
          "x-api-key": "invalid-key",
        },
      },
    );

    const { POST } = await import(
      "@/app/api/threads/[threadId]/messages/route"
    );
    const res = await POST(req, {
      params: Promise.resolve({ threadId: "00000000-0000-4000-8000-000000000001" }),
    } as never);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid API key");
  });

  it("returns 400 when body field is missing", async () => {
    vi.mocked(createAuthServerClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
    } as never);

    const req = new NextRequest(
      "http://localhost:3000/api/threads/00000000-0000-4000-8000-000000000001/messages",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
      },
    );

    const { POST } = await import(
      "@/app/api/threads/[threadId]/messages/route"
    );
    const res = await POST(req, {
      params: Promise.resolve({ threadId: "00000000-0000-4000-8000-000000000001" }),
    } as never);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("body");
  });

  it("returns 201 when authenticated via session and body is valid", async () => {
    vi.mocked(createAuthServerClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
    } as never);

    const mockMessageRepo = {
      create: vi.fn().mockResolvedValue({
        id: "msg-1",
        thread_id: "00000000-0000-4000-8000-000000000001",
        author_id: "user-1",
        author_kind: "user",
        author_name: null,
        body: "Hello world",
        created_at: new Date().toISOString(),
      }),
    };

    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: { company_id: "c1" }, error: null }),
          }),
        }),
      }),
    };

    vi.mocked(createServerClient).mockReturnValue(mockDb as never);
    vi.mocked(createMessageRepo).mockReturnValue(mockMessageRepo as never);

    const req = new NextRequest(
      "http://localhost:3000/api/threads/00000000-0000-4000-8000-000000000001/messages",
      {
        method: "POST",
        body: JSON.stringify({ body: "Hello world" }),
        headers: { "content-type": "application/json" },
      },
    );

    const { POST } = await import(
      "@/app/api/threads/[threadId]/messages/route"
    );
    const res = await POST(req, {
      params: Promise.resolve({ threadId: "00000000-0000-4000-8000-000000000001" }),
    } as never);

    expect(res.status).toBe(201);
  });
});
