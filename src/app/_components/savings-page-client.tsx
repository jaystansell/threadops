"use client";

import { useEffect, useState } from "react";

interface AgentSavings {
  apiKeyId: string;
  label: string;
  modelTier: string;
  totalQueries: number;
  totalTokensWithout: number;
  totalTokensWith: number;
  totalTokensSaved: number;
  dollarsSaved: number;
  dollarsWithout: number;
  dollarsWith: number;
  firstLogAt: string | null;
}

interface PricingData {
  budget: number;
  standard: number;
  premium: number;
}

interface SavingsResponse {
  company: {
    totalQueries: number;
    totalTokensSaved: number;
    dollarsSaved: number;
    dollarsWithout: number;
    dollarsWith: number;
    humanTimeDollarsSaved: number;
    minutesSaved: number;
    firstLogAt: string | null;
  };
  agents: AgentSavings[];
  pricing: PricingData;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function formatDollars(n: number): string {
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 0.01) return `$${n.toFixed(2)}`;
  if (n > 0) return `<$0.01`;
  return `$0.00`;
}

function formatMinutes(m: number): string {
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
  }
  return `${m}m`;
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function SavingsPageClient({ companyId }: { companyId: string }) {
  const [data, setData] = useState<SavingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/companies/${companyId}/savings`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load savings data");
        return res.json();
      })
      .then((d: SavingsResponse) => setData(d))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [companyId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-6 animate-pulse"
          >
            <div className="h-4 bg-[var(--border)] rounded w-1/3 mb-4" />
            <div className="h-8 bg-[var(--border)] rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (!data || data.company.totalQueries === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-6">
          <p className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] font-mono mb-2">
            Savings since Day 1
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">
            No usage data yet. Savings tracking starts automatically when your
            agents read threads via the API or MCP.
          </p>
        </div>
        <PricingTiersSection pricing={data?.pricing ?? null} />
      </div>
    );
  }

  const days = daysSince(data.company.firstLogAt);
  const totalSaved =
    data.company.dollarsSaved + (data.company.humanTimeDollarsSaved ?? 0);

  return (
    <div className="space-y-4">
      {/* Total savings hero */}
      <div className="rounded-xl border border-[var(--accent)] bg-[var(--accent)]/10 p-6">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--accent)] font-mono mb-1">
              Total Savings since Day 1
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {days} day{days !== 1 ? "s" : ""} of tracking
            </p>
          </div>
          <p className="text-3xl font-bold font-mono text-[var(--accent)]">
            {formatDollars(totalSaved)}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-5">
          <div>
            <p className="text-xl font-bold font-mono text-[var(--accent)]">
              {formatTokens(data.company.totalTokensSaved)}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              tokens saved
            </p>
          </div>
          <div>
            <p className="text-xl font-bold font-mono text-[var(--accent)]">
              {formatDollars(data.company.dollarsSaved)}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              token cost saved
            </p>
          </div>
          <div>
            <p className="text-xl font-bold font-mono text-[var(--accent)]">
              {formatDollars(data.company.humanTimeDollarsSaved ?? 0)}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              human time saved ({formatMinutes(data.company.minutesSaved ?? 0)})
            </p>
          </div>
          <div>
            <p className="text-xl font-bold font-mono">
              {data.company.totalQueries.toLocaleString()}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              thread reads
            </p>
          </div>
          <div>
            <p className="text-xl font-bold font-mono">
              {data.company.dollarsSaved > 0
                ? `${((1 - data.company.dollarsWith / data.company.dollarsWithout) * 100).toFixed(0)}%`
                : "\u2014"}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              cost reduction
            </p>
          </div>
        </div>
      </div>

      {/* Per-agent breakdown */}
      {data.agents.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5">
          <p className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] font-mono mb-3">
            Per-agent savings
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 px-3 text-[var(--muted-foreground)] font-medium">
                    Agent
                  </th>
                  <th className="text-right py-2 px-3 text-[var(--muted-foreground)] font-medium">
                    Tier
                  </th>
                  <th className="text-right py-2 px-3 text-[var(--muted-foreground)] font-medium">
                    Reads
                  </th>
                  <th className="text-right py-2 px-3 text-[var(--muted-foreground)] font-medium">
                    Tokens Saved
                  </th>
                  <th className="text-right py-2 px-3 text-[var(--muted-foreground)] font-medium">
                    Token $ Saved
                  </th>
                  <th className="text-right py-2 px-3 text-[var(--muted-foreground)] font-medium">
                    Time $ Saved
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.agents.map((agent) => {
                  const agentMinutes = agent.totalQueries * 2;
                  const agentHumanSaved =
                    (agentMinutes / 60) * (100_000 / 2_080);
                  return (
                    <tr
                      key={agent.apiKeyId}
                      className="border-b border-[var(--border)]/50"
                    >
                      <td className="py-2 px-3 font-medium">{agent.label}</td>
                      <td className="py-2 px-3 text-right">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] capitalize">
                          {agent.modelTier}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {agent.totalQueries.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {formatTokens(agent.totalTokensSaved)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-[var(--accent)]">
                        {formatDollars(agent.dollarsSaved)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-[var(--accent)]">
                        {formatDollars(agentHumanSaved)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-[var(--muted-foreground)] mt-3">
            Human time based on $100K/yr salary, ~2 min saved per thread read
          </p>
        </div>
      )}

      {/* Pricing tiers */}
      <PricingTiersSection pricing={data.pricing} />
    </div>
  );
}

function PricingTiersSection({ pricing }: { pricing: PricingData | null }) {
  const tiers = pricing ?? { budget: 3, standard: 9, premium: 16 };
  const tierList: { name: string; key: keyof PricingData; desc: string }[] = [
    { name: "Budget", key: "budget", desc: "Haiku / GPT-mini class" },
    { name: "Standard", key: "standard", desc: "Sonnet / GPT class" },
    { name: "Premium", key: "premium", desc: "Opus / GPT-max class" },
  ];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5">
      <p className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] font-mono mb-3">
        Pricing Tiers
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {tierList.map((t) => (
          <div
            key={t.key}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-center"
          >
            <p className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] font-mono mb-1">
              {t.name}
            </p>
            <p className="text-xl font-bold font-mono text-[var(--accent)]">
              ${tiers[t.key]}/MTok
            </p>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
              {t.desc}
            </p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-[var(--muted-foreground)] mt-3">
        Real-time pricing per million tokens. Tier is auto-detected from agent
        User-Agent header.
      </p>
    </div>
  );
}
