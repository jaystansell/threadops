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
  const now = new Date().toISOString();
  const errors: string[] = [];

  for (const p of Object.values(FALLBACK_PRICING)) {
    const { data, error } = await db
      .from("model_pricing")
      .update({
        cost_per_mtok: p.costPerMTok,
        label: p.label,
        updated_at: now,
      })
      .eq("model_tier", p.tier)
      .select("id");

    if (error) {
      errors.push(`${p.tier}: ${error.message}`);
    } else if (!data || data.length === 0) {
      const { error: insertErr } = await db
        .from("model_pricing")
        .insert({
          model_pattern: p.tier,
          model_tier: p.tier,
          cost_per_mtok: p.costPerMTok,
          label: p.label,
          updated_at: now,
        });
      if (insertErr) errors.push(`${p.tier} insert: ${insertErr.message}`);
    }
  }

  if (errors.length > 0) {
    return Response.json({ error: errors.join("; ") }, { status: 500 });
  }

  return Response.json({
    message: "Model pricing updated",
    tiers: Object.keys(FALLBACK_PRICING).length,
    updated_at: now,
  });
}
