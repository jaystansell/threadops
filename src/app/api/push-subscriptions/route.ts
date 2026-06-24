import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";

export const dynamic = "force-dynamic";

/** Save a push subscription for the authenticated user */
export async function POST(req: NextRequest) {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { endpoint, keys } = body;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return Response.json(
      { error: "endpoint, keys.p256dh, and keys.auth are required" },
      { status: 400 },
    );
  }

  const db = createServerClient();

  // Look up user's company
  const { data: membership } = await db
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) {
    return Response.json({ error: "No company found" }, { status: 400 });
  }

  // Upsert subscription (unique on user_id + endpoint)
  const { data, error } = await db
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        company_id: membership.company_id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: req.headers.get("user-agent") ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" },
    )
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}

/** Remove a push subscription */
export async function DELETE(req: NextRequest) {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { endpoint } = body;

  if (!endpoint) {
    return Response.json({ error: "endpoint is required" }, { status: 400 });
  }

  const db = createServerClient();
  await db
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  return Response.json({ ok: true });
}

/** List push subscriptions for the authenticated user */
export async function GET() {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServerClient();
  const { data, error } = await db
    .from("push_subscriptions")
    .select("id, endpoint, created_at, updated_at, user_agent")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
