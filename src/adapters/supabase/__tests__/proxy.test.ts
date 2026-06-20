import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getClaims: vi.fn(),
    },
  })),
}));

function createMockRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

describe("updateSession (auth proxy)", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  it("redirects to /login when unauthenticated user hits protected route", async () => {
    const { createServerClient } = await import("@supabase/ssr");
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: null } }),
      },
    } as never);

    const { updateSession } = await import("../auth/proxy");
    const req = createMockRequest("/threads");
    const res = await updateSession(req);

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("redirects to /threads when authenticated user hits /login", async () => {
    const { createServerClient } = await import("@supabase/ssr");
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getClaims: vi
          .fn()
          .mockResolvedValue({ data: { claims: { sub: "user-1" } } }),
      },
    } as never);

    const { updateSession } = await import("../auth/proxy");
    const req = createMockRequest("/login");
    const res = await updateSession(req);

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/threads");
  });

  it("passes through for unprotected routes without auth", async () => {
    const { createServerClient } = await import("@supabase/ssr");
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: null } }),
      },
    } as never);

    const { updateSession } = await import("../auth/proxy");
    const req = createMockRequest("/docs/api");
    const res = await updateSession(req);

    expect(res.status).toBe(200);
  });

  it("passes through for protected routes with valid auth", async () => {
    const { createServerClient } = await import("@supabase/ssr");
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getClaims: vi
          .fn()
          .mockResolvedValue({ data: { claims: { sub: "user-1" } } }),
      },
    } as never);

    const { updateSession } = await import("../auth/proxy");
    const req = createMockRequest("/threads/some-id");
    const res = await updateSession(req);

    expect(res.status).toBe(200);
  });
});
