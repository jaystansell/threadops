import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ promptId: string }> },
) {
  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { promptId } = await props.params;
  const body = await req.json();
  const { title, body: promptBody, agent_scope } = body;

  if (!title || typeof title !== "string" || !title.trim()) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }
  if (!promptBody || typeof promptBody !== "string" || !promptBody.trim()) {
    return Response.json({ error: "body is required" }, { status: 400 });
  }

  const db = createServerClient();
  const { data, error } = await db
    .from("saved_prompts")
    .update({
      title: title.trim(),
      body: promptBody.trim(),
      agent_scope: agent_scope ?? { all: true },
    })
    .eq("id", promptId)
    .eq("user_id", userCompany.userId)
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(data);
}

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ promptId: string }> },
) {
  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { promptId } = await props.params;
  const db = createServerClient();

  const { error } = await db
    .from("saved_prompts")
    .delete()
    .eq("id", promptId)
    .eq("user_id", userCompany.userId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
