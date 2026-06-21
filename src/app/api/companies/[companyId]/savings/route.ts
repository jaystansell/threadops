import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createUsageLogRepo } from "@/adapters/supabase/usage-log-repo";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { FALLBACK_PRICING } from "@/core/config/model-pricing";
import type { CompanyId } from "@/core/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await props.params;

  const userCompany = await getUserCompany();
  if (!userCompany || userCompany.companyId !== companyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServerClient();
  const usageRepo = createUsageLogRepo(db);

  try {
    const [companySavings, perKeySavings] = await Promise.all([
      usageRepo.getCompanySavings(companyId as CompanyId),
      usageRepo.getPerKeySavings(companyId as CompanyId),
    ]);

    // Fetch model pricing from DB, fall back to config
    let pricing = FALLBACK_PRICING;
    const { data: dbPricing } = await db
      .from("model_pricing")
      .select("model_tier, cost_per_mtok");
    if (dbPricing && dbPricing.length > 0) {
      const pricingMap: Record<string, number> = {};
      for (const row of dbPricing) {
        pricingMap[row.model_tier as string] = Number(row.cost_per_mtok);
      }
      if (pricingMap.budget) pricing = { ...pricing, budget: { ...pricing.budget, costPerMTok: pricingMap.budget } };
      if (pricingMap.standard) pricing = { ...pricing, standard: { ...pricing.standard, costPerMTok: pricingMap.standard } };
      if (pricingMap.premium) pricing = { ...pricing, premium: { ...pricing.premium, costPerMTok: pricingMap.premium } };
    }

    // Calculate dollar savings per agent
    const agentSavings = perKeySavings.map((agent) => {
      const tier = agent.modelTier as keyof typeof pricing;
      const costPerToken = (pricing[tier]?.costPerMTok ?? pricing.standard.costPerMTok) / 1_000_000;
      return {
        ...agent,
        dollarsSaved: agent.totalTokensSaved * costPerToken,
        dollarsWithout: agent.totalTokensWithout * costPerToken,
        dollarsWith: agent.totalTokensWith * costPerToken,
      };
    });

    // Total dollar savings
    const totalDollarsSaved = agentSavings.reduce((sum, a) => sum + a.dollarsSaved, 0);
    const totalDollarsWithout = agentSavings.reduce((sum, a) => sum + a.dollarsWithout, 0);
    const totalDollarsWith = agentSavings.reduce((sum, a) => sum + a.dollarsWith, 0);

    return Response.json({
      company: {
        ...companySavings,
        dollarsSaved: totalDollarsSaved,
        dollarsWithout: totalDollarsWithout,
        dollarsWith: totalDollarsWith,
      },
      agents: agentSavings,
      pricing: {
        budget: pricing.budget.costPerMTok,
        standard: pricing.standard.costPerMTok,
        premium: pricing.premium.costPerMTok,
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
