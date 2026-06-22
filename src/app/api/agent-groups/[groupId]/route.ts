import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";

export const dynamic = "force-dynamic";

async function verifyGroupOwnership(groupId: string) {
  const userCompany = await getUserCompany();
  if (!userCompany) return null;

  const db = createServerClient();
  const { data: group } = await db
    .from("agent_groups")
    .select("id, company_id, user_id, name, color, sort_order")
    .eq("id", groupId)
    .eq("user_id", userCompany.userId)
    .single();

  if (!group) return null;
  return { userCompany, db, group };
}

/** PATCH: update group name, color, sort_order, or members */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ groupId: string }> },
) {
  const { groupId } = await ctx.params;
  const result = await verifyGroupOwnership(groupId);
  if (!result) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { db } = result;
  const body = await req.json();
  const { name, color, sort_order, agent_key_ids } = body as {
    name?: string;
    color?: string;
    sort_order?: number;
    agent_key_ids?: string[];
  };

  // Update group fields
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (color !== undefined) updates.color = color;
  if (sort_order !== undefined) updates.sort_order = sort_order;

  if (Object.keys(updates).length > 0) {
    const { error } = await db
      .from("agent_groups")
      .update(updates)
      .eq("id", groupId);
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  // Replace members if provided
  if (agent_key_ids !== undefined) {
    await db.from("agent_group_members").delete().eq("group_id", groupId);
    if (agent_key_ids.length > 0) {
      const rows = agent_key_ids.map((keyId: string) => ({
        group_id: groupId,
        api_key_id: keyId,
      }));
      const { error } = await db.from("agent_group_members").insert(rows);
      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
    }
  }

  return Response.json({ success: true });
}

/** DELETE: remove a group and its memberships (cascade) */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ groupId: string }> },
) {
  const { groupId } = await ctx.params;
  const result = await verifyGroupOwnership(groupId);
  if (!result) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { db } = result;
  const { error } = await db.from("agent_groups").delete().eq("id", groupId);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
