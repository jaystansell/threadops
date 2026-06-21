export type ModelTier = "budget" | "standard" | "premium";

export interface ModelPricing {
  tier: ModelTier;
  costPerMTok: number;
  label: string;
}

/**
 * Fallback pricing used when the model_pricing DB table is unavailable.
 * Updated monthly (target: 1st of each month).
 * Last updated: June 2026.
 */
export const FALLBACK_PRICING: Record<ModelTier, ModelPricing> = {
  budget:   { tier: "budget",   costPerMTok: 3,  label: "Haiku 4.5 / GPT-5.4 mini" },
  standard: { tier: "standard", costPerMTok: 9,  label: "Sonnet 4.6 / GPT-5.4" },
  premium:  { tier: "premium",  costPerMTok: 16, label: "Opus 4.8 / GPT-5.5" },
};

export const DEFAULT_TIER: ModelTier = "standard";

export const TOKENS_PER_MESSAGE = 500;
export const SUMMARY_TOKENS = 500;

/**
 * Patterns matched (case-insensitive) against the User-Agent header
 * to auto-detect which model tier an agent is using.
 */
export const USER_AGENT_PATTERNS: { pattern: RegExp; tier: ModelTier }[] = [
  { pattern: /haiku/i,        tier: "budget" },
  { pattern: /gpt-5\.4-mini/i, tier: "budget" },
  { pattern: /mini/i,         tier: "budget" },
  { pattern: /opus/i,         tier: "premium" },
  { pattern: /gpt-5\.5/i,     tier: "premium" },
  { pattern: /o1/i,           tier: "premium" },
  { pattern: /sonnet/i,       tier: "standard" },
  { pattern: /gpt-5\.4/i,     tier: "standard" },
  { pattern: /claude/i,       tier: "standard" },
];

export function detectModelTier(userAgent: string | null): ModelTier | null {
  if (!userAgent) return null;
  for (const { pattern, tier } of USER_AGENT_PATTERNS) {
    if (pattern.test(userAgent)) return tier;
  }
  return null;
}

export function costPerToken(tier: ModelTier): number {
  return FALLBACK_PRICING[tier].costPerMTok / 1_000_000;
}
