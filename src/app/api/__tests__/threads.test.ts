import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/adapters/supabase/client", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/adapters/supabase/thread-repo", () => ({
  createThreadRepo: vi.fn(),
}));

vi.mock("@/adapters/supabase/message-repo", () => ({
  createMessageRepo: vi.fn(),
}));

vi.mock("@/adapters/supabase/auth/server", () => ({
  createAuthServerClient: vi.fn(),
}));

vi.mock("@/adapters/supabase/auth/get-user-company", () => ({
  getUserCompany: vi.fn(),
}));

vi.mock("@/adapters/supabase/outbound-webhook", () => ({
  dispatchOutboundWebhooks: vi.fn(),
}));

import { createAuthServerClient } from "@/adapters/supabase/auth/server";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";

describe("POST /api/threads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(createAuthServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never);

    const req = new NextRequest("http://localhost:3000/api/threads", {
      method: "POST",
      body: JSON.stringify({
        title: "Test",
        company_id: "c1",
        message_body: "Hello",
      }),
      headers: { "content-type": "application/json" },
    });

    const { POST } = await import("@/app/api/threads/route");
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when title is missing", async () => {
    vi.mocked(createAuthServerClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
    } as never);

    const req = new NextRequest("http://localhost:3000/api/threads", {
      method: "POST",
      body: JSON.stringify({ company_id: "c1", message_body: "Hello" }),
      headers: { "content-type": "application/json" },
    });

    const { POST } = await import("@/app/api/threads/route");
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("title");
  });

  it("returns 400 when company_id is missing", async () => {
    vi.mocked(createAuthServerClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
    } as never);

    const req = new NextRequest("http://localhost:3000/api/threads", {
      method: "POST",
      body: JSON.stringify({ title: "Test", message_body: "Hello" }),
      headers: { "content-type": "application/json" },
    });

    const { POST } = await import("@/app/api/threads/route");
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("company_id");
  });

  it("returns 400 when message_body is missing", async () => {
    vi.mocked(createAuthServerClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
    } as never);

    const req = new NextRequest("http://localhost:3000/api/threads", {
      method: "POST",
      body: JSON.stringify({ title: "Test", company_id: "c1" }),
      headers: { "content-type": "application/json" },
    });

    const { POST } = await import("@/app/api/threads/route");
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("message_body");
  });
});

describe("GET /api/threads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getUserCompany).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/threads");
    const { GET } = await import("@/app/api/threads/route");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
