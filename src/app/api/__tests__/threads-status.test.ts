import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/adapters/supabase/client", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/adapters/supabase/thread-repo", () => ({
  createThreadRepo: vi.fn(),
}));

vi.mock("@/adapters/supabase/auth/server", () => ({
  createAuthServerClient: vi.fn(),
}));

vi.mock("@/adapters/supabase/outbound-webhook", () => ({
  dispatchOutboundWebhooks: vi.fn(),
}));

import { createServerClient } from "@/adapters/supabase/client";
import { createThreadRepo } from "@/adapters/supabase/thread-repo";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";

describe("PATCH /api/threads/[threadId]/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function callPATCH(body: unknown, authenticated = true) {
    vi.mocked(createAuthServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: authenticated ? { id: "user-1" } : null },
        }),
      },
    } as never);

    const mockThreadRepo = {
      getById: vi.fn().mockResolvedValue({
        id: "00000000-0000-4000-8000-000000000001",
        status: "open",
        company_id: "company-1",
        updated_at: new Date().toISOString(),
      }),
      updateStatus: vi.fn().mockResolvedValue({
        id: "00000000-0000-4000-8000-000000000001",
        status: (body as Record<string, unknown>)?.status ?? "archived",
        company_id: "company-1",
        updated_at: new Date().toISOString(),
      }),
    };

    const mockDb = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    };
    vi.mocked(createServerClient).mockReturnValue(mockDb as never);
    vi.mocked(createThreadRepo).mockReturnValue(mockThreadRepo as never);

    const req = new NextRequest("http://localhost:3000/api/threads/00000000-0000-4000-8000-000000000001/status", {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });

    const { PATCH } = await import(
      "@/app/api/threads/[threadId]/status/route"
    );
    return PATCH(req, {
      params: Promise.resolve({ threadId: "00000000-0000-4000-8000-000000000001" }),
    } as never);
  }

  it("returns 401 when not authenticated", async () => {
    const res = await callPATCH(
      { status: "archived", company_id: "company-1" },
      false,
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 when status is missing", async () => {
    const res = await callPATCH({ company_id: "company-1" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when status is invalid", async () => {
    const res = await callPATCH({
      status: "invalid",
      company_id: "company-1",
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when company_id is missing", async () => {
    const res = await callPATCH({ status: "archived" });
    expect(res.status).toBe(400);
  });

  it("returns 422 for invalid status transition (self-transition)", async () => {
    vi.mocked(createAuthServerClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
    } as never);

    const mockThreadRepo = {
      getById: vi.fn().mockResolvedValue({
        id: "00000000-0000-4000-8000-000000000001",
        status: "open",
        company_id: "company-1",
      }),
      updateStatus: vi.fn(),
    };

    vi.mocked(createServerClient).mockReturnValue({} as never);
    vi.mocked(createThreadRepo).mockReturnValue(mockThreadRepo as never);

    const req = new NextRequest(
      "http://localhost:3000/api/threads/00000000-0000-4000-8000-000000000001/status",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "open", company_id: "company-1" }),
        headers: { "content-type": "application/json" },
      },
    );

    const { PATCH } = await import(
      "@/app/api/threads/[threadId]/status/route"
    );
    const res = await PATCH(req, {
      params: Promise.resolve({ threadId: "00000000-0000-4000-8000-000000000001" }),
    } as never);

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toContain("Cannot transition");
  });

  it("returns 200 for a valid transition (open → archived)", async () => {
    const res = await callPATCH({
      status: "archived",
      company_id: "company-1",
    });
    expect(res.status).toBe(200);
  });
});
