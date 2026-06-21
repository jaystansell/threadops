import { TOKENS_PER_MESSAGE, SUMMARY_TOKENS, FALLBACK_PRICING } from "@/core/config/model-pricing";

const HOURLY_RATE = 100_000 / 2_080; // $100K/yr, 2080 work hours

interface ThreadSavingsBannerProps {
  messageCount: number;
  readCount: number;
  modelTier: string;
  costPerMTok: number | null;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function formatDollars(n: number): string {
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(2)}`;
  return `<$0.01`;
}

export function ThreadSavingsBanner({
  messageCount,
  readCount,
  modelTier,
  costPerMTok,
}: ThreadSavingsBannerProps) {
  if (messageCount === 0) return null;

  const tier = modelTier as keyof typeof FALLBACK_PRICING;
  const rate = costPerMTok ?? FALLBACK_PRICING[tier]?.costPerMTok ?? FALLBACK_PRICING.standard.costPerMTok;
  const costPerToken = rate / 1_000_000;

  const tokensWithout = messageCount * TOKENS_PER_MESSAGE;
  const tokensWith = SUMMARY_TOKENS;
  const tokensSaved = tokensWithout - tokensWith;

  const totalTokensSaved = tokensSaved * Math.max(readCount, 1);
  const dollarsSaved = totalTokensSaved * costPerToken;

  // Human time: estimate 2 min per thread for manual triage/context switching
  const minutesSaved = Math.max(readCount, 1) * 2;
  const humanDollarsSaved = (minutesSaved / 60) * HOURLY_RATE;

  return (
    <div className="mt-3 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1">
      <span className="text-[10px] uppercase tracking-widest text-[var(--accent)] font-mono font-semibold">
        Savings
      </span>
      <Stat
        value={formatTokens(totalTokensSaved)}
        label="tokens saved"
      />
      <Stat
        value={formatDollars(dollarsSaved)}
        label="token cost saved"
        accent
      />
      <Stat
        value={formatDollars(humanDollarsSaved)}
        label="human time saved"
      />
      <Stat
        value={`${readCount}`}
        label={readCount === 1 ? "read" : "reads"}
      />
    </div>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-sm font-bold font-mono ${accent ? "text-[var(--accent)]" : ""}`}>
        {value}
      </span>
      <span className="text-[10px] text-[var(--muted-foreground)]">{label}</span>
    </div>
  );
}
