import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { FALLBACK_PRICING } from "@/core/config/model-pricing";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/update-pricing
 *
 * Monthly cron (1st of each month) that refreshes the model_pricing table
 * with current fallback values. In the future, this could pull from
 * public pricing APIs.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServerClient();

  const entries = Object.values(FALLBACK_PRICING).map((p) => ({
    model_pattern: p.tier,
    model_tier: p.tier,
    cost_per_mtok: p.costPerMTok,
    label: p.label,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await db
    .from("model_pricing")
    .upsert(entries, { onConflict: "model_pattern" });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    message: "Model pricing updated",
    tiers: entries.length,
    updated_at: new Date().toISOString(),
  });
}
