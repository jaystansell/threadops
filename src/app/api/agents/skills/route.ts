import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createApiKeyRepo } from "@/adapters/supabase/api-key-repo";
import { hashKey } from "@/core/rules/api-key";

export const dynamic = "force-dynamic";

async function resolveApiKey(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return null;
  const db = createServerClient();
  const apiKeyRepo = createApiKeyRepo(db);
  const keyHash = await hashKey(apiKey);
  const keyRecord = await apiKeyRepo.lookupByHash(keyHash);
  if (!keyRecord) return null;
  await apiKeyRepo.touchLastUsed(keyRecord.id);
  return keyRecord;
}

/**
 * PUT /api/agents/skills
 * Agent sends its current skill list. We diff against stored skills
 * and reconcile (add new, remove stale).
 *
 * Body: { "skills": ["summarize", "translate", "extract_actions"] }
 * Auth: X-API-Key header (required)
 */
export async function PUT(req: NextRequest) {
  const keyRecord = await resolveApiKey(req);
  if (!keyRecord) {
    return Response.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.skills)) {
    return Response.json(
      { error: "Body must include 'skills' as an array of strings" },
      { status: 400 },
    );
  }

  const skills: string[] = body.skills
    .filter((s: unknown) => typeof s === "string" && s.trim().length > 0)
    .map((s: string) => s.trim());

  const db = createServerClient();
  const apiKeyId = keyRecord.id;

  // Fetch current skills
  const { data: existing } = await db
    .from("agent_skills")
    .select("id, skill_name")
    .eq("api_key_id", apiKeyId);

  const existingNames = new Set((existing ?? []).map((r: { skill_name: string }) => r.skill_name));
  const incomingNames = new Set(skills);

  // Remove skills no longer reported
  const toRemove = (existing ?? []).filter(
    (r: { id: string; skill_name: string }) => !incomingNames.has(r.skill_name),
  );
  if (toRemove.length > 0) {
    await db
      .from("agent_skills")
      .delete()
      .in("id", toRemove.map((r: { id: string }) => r.id));
  }

  // Add new skills
  const toAdd = skills.filter((s: string) => !existingNames.has(s));
  if (toAdd.length > 0) {
    await db
      .from("agent_skills")
      .insert(toAdd.map((skill_name: string) => ({ api_key_id: apiKeyId, skill_name })));
  }

  return Response.json({
    ok: true,
    agent: keyRecord.label,
    skills,
    added: toAdd,
    removed: toRemove.map((r: { skill_name: string }) => r.skill_name),
  });
}

/**
 * GET /api/agents/skills
 * Returns skills for the calling agent (API key auth).
 */
export async function GET(req: NextRequest) {
  const keyRecord = await resolveApiKey(req);
  if (!keyRecord) {
    return Response.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  const db = createServerClient();
  const { data, error } = await db
    .from("agent_skills")
    .select("skill_name, created_at")
    .eq("api_key_id", keyRecord.id)
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    agent: keyRecord.label,
    skills: (data ?? []).map((r: { skill_name: string; created_at: string }) => r.skill_name),
  });
}
