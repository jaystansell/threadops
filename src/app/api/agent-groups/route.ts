import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";

export const dynamic = "force-dynamic";

/** GET: list all groups for the current user with their agent members */
export async function GET() {
  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServerClient();

  const { data: groups, error } = await db
    .from("agent_groups")
    .select("id, name, color, sort_order")
    .eq("company_id", userCompany.companyId)
    .eq("user_id", userCompany.userId)
    .order("sort_order", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Fetch members for all groups
  const groupIds = (groups ?? []).map((g: { id: string }) => g.id);
  const membersMap: Record<string, string[]> = {};
  if (groupIds.length > 0) {
    const { data: members } = await db
      .from("agent_group_members")
      .select("group_id, api_key_id")
      .in("group_id", groupIds);
    for (const m of members ?? []) {
      const gid = m.group_id as string;
      if (!membersMap[gid]) membersMap[gid] = [];
      membersMap[gid].push(m.api_key_id as string);
    }
  }

  const result = (groups ?? []).map((g: { id: string; name: string; color: string; sort_order: number }) => ({
    ...g,
    agent_key_ids: membersMap[g.id] ?? [],
  }));

  return Response.json(result);
}

/** POST: create a new group */
export async function POST(req: NextRequest) {
  const userCompany = await getUserCompany();
  if (!userCompany) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, color = "teal", agent_key_ids = [] } = body as {
    name?: string;
    color?: string;
    agent_key_ids?: string[];
  };

  if (!name || !name.trim()) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const db = createServerClient();

  // Get next sort order
  const { data: existing } = await db
    .from("agent_groups")
    .select("sort_order")
    .eq("company_id", userCompany.companyId)
    .eq("user_id", userCompany.userId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = ((existing?.[0]?.sort_order as number) ?? -1) + 1;

  const { data: group, error } = await db
    .from("agent_groups")
    .insert({
      company_id: userCompany.companyId,
      user_id: userCompany.userId,
      name: name.trim(),
      color,
      sort_order: nextOrder,
    })
    .select("id, name, color, sort_order")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Add agent members if provided
  if (agent_key_ids.length > 0) {
    const rows = agent_key_ids.map((keyId: string) => ({
      group_id: group.id,
      api_key_id: keyId,
    }));
    await db.from("agent_group_members").insert(rows);
  }

  return Response.json({ ...group, agent_key_ids }, { status: 201 });
}
