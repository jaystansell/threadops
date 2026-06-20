import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

interface CookieEntry {
  name: string;
  value: string;
  options: CookieOptions;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieEntry[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const path = request.nextUrl.pathname;

  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/auth");

  const isProtectedRoute =
    path.startsWith("/threads") ||
    path.startsWith("/onboarding") ||
    path.startsWith("/api/threads") ||
    path.startsWith("/api/companies");

  const apiKeyRoutes = ["/api/threads/", "/api/webhooks/inbound"];
  const hasApiKey =
    apiKeyRoutes.some((r) => path.startsWith(r)) &&
    request.headers.has("x-api-key");

  if (isProtectedRoute && !user && !hasApiKey) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/threads";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
