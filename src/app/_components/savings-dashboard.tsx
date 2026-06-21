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

interface SavingsData {
  company: {
    totalQueries: number;
    totalTokensSaved: number;
    dollarsSaved: number;
    dollarsWithout: number;
    dollarsWith: number;
    firstLogAt: string | null;
  };
  agents: AgentSavings[];
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function formatDollars(n: number): string {
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function SavingsDashboard({ companyId }: { companyId: string }) {
  const [data, setData] = useState<SavingsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/companies/${companyId}/savings`)
      .then((res) => res.json())
      .then((d: SavingsData) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-6 animate-pulse">
        <div className="h-4 bg-[var(--border)] rounded w-1/3 mb-4" />
        <div className="h-8 bg-[var(--border)] rounded w-1/2" />
      </div>
    );
  }

  if (!data || data.company.totalQueries === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-6">
        <p className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] font-mono mb-2">
          Token Savings
        </p>
        <p className="text-sm text-[var(--muted-foreground)]">
          No usage data yet. Savings tracking starts automatically when your agents
          read threads via the API or MCP.
        </p>
      </div>
    );
  }

  const days = daysSince(data.company.firstLogAt);

  return (
    <div className="space-y-4">
      {/* Company-wide summary card */}
      <div className="rounded-xl border border-[var(--accent)] bg-[var(--accent)]/10 p-6">
        <p className="text-xs uppercase tracking-widest text-[var(--accent)] font-mono mb-1">
          Savings since Day 1
        </p>
        <p className="text-xs text-[var(--muted-foreground)] mb-4">
          {days} day{days !== 1 ? "s" : ""} of tracking
        </p>
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <p className="text-2xl font-bold font-mono text-[var(--accent)]">
              {formatDollars(data.company.dollarsSaved)}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">saved</p>
          </div>
          <div>
            <p className="text-2xl font-bold font-mono">
              {formatTokens(data.company.totalTokensSaved)}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">tokens saved</p>
          </div>
          <div>
            <p className="text-2xl font-bold font-mono">
              {data.company.totalQueries.toLocaleString()}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">thread reads</p>
          </div>
          <div>
            <p className="text-2xl font-bold font-mono">
              {data.company.dollarsSaved > 0
                ? `${((1 - data.company.dollarsWith / data.company.dollarsWithout) * 100).toFixed(0)}%`
                : "—"}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">cost reduction</p>
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
                    $ Saved
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.agents.map((agent) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
