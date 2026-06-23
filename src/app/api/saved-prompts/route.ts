import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";

export const dynamic = "force-dynamic";

export async function GET() {
  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServerClient();
  const { data, error } = await db
    .from("saved_prompts")
    .select("*")
    .eq("user_id", userCompany.userId)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function POST(req: NextRequest) {
  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { title, body: promptBody, agent_scope } = body;

  if (!title || typeof title !== "string" || !title.trim()) {
    return Response.json(
      { error: "title is required" },
      { status: 400 },
    );
  }
  if (!promptBody || typeof promptBody !== "string" || !promptBody.trim()) {
    return Response.json(
      { error: "body is required" },
      { status: 400 },
    );
  }

  const scope = agent_scope ?? { all: true };

  const db = createServerClient();
  const { data, error } = await db
    .from("saved_prompts")
    .insert({
      user_id: userCompany.userId,
      title: title.trim(),
      body: promptBody.trim(),
      agent_scope: scope,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}
