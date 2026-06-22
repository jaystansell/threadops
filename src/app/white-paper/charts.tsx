"use client";

interface BarDatum {
  label: string;
  without: number;
  with: number;
}

function formatDollars(n: number): string {
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function TokenComparisonChart({ data }: { data: BarDatum[] }) {
  const max = Math.max(...data.flatMap((d) => [d.without, d.with]));

  return (
    <div className="space-y-6">
      {data.map((d) => (
        <div key={d.label}>
          <p className="text-sm font-medium mb-2">{d.label}</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--muted-foreground)] w-28 shrink-0">Platform summary</span>
              <div className="flex-1 h-7 rounded bg-[var(--muted)] overflow-hidden">
                <div
                  className="h-full rounded bg-[var(--destructive)]/60 flex items-center px-2 transition-all duration-700"
                  style={{ width: `${(d.without / max) * 100}%` }}
                >
                  <span className="text-xs font-mono text-[var(--foreground)]">
                    {formatDollars(d.without)}/mo
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--muted-foreground)] w-28 shrink-0">With Threadzy</span>
              <div className="flex-1 h-7 rounded bg-[var(--muted)] overflow-hidden">
                <div
                  className="h-full rounded bg-[var(--accent)] flex items-center px-2 transition-all duration-700"
                  style={{ width: `${Math.max((d.with / max) * 100, 3)}%` }}
                >
                  <span className="text-xs font-mono text-[var(--accent-foreground)]">
                    {formatDollars(d.with)}/mo
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface SavingsScenario {
  label: string;
  monthlySavings: number;
  annualSavings: number;
  percentReduction: number;
}

export function SavingsSummaryTable({ scenarios }: { scenarios: SavingsScenario[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left py-3 px-4 text-[var(--muted-foreground)] font-medium">Scenario</th>
            <th className="text-right py-3 px-4 text-[var(--muted-foreground)] font-medium">Monthly Savings</th>
            <th className="text-right py-3 px-4 text-[var(--muted-foreground)] font-medium">Annual Savings</th>
            <th className="text-right py-3 px-4 text-[var(--muted-foreground)] font-medium">Reduction</th>
          </tr>
        </thead>
        <tbody>
          {scenarios.map((s) => (
            <tr key={s.label} className="border-b border-[var(--border)]/50">
              <td className="py-3 px-4 font-medium">{s.label}</td>
              <td className="py-3 px-4 text-right font-mono text-[var(--accent)]">
                {formatDollars(s.monthlySavings)}
              </td>
              <td className="py-3 px-4 text-right font-mono text-[var(--accent)]">
                {formatDollars(s.annualSavings)}
              </td>
              <td className="py-3 px-4 text-right">
                <span className="inline-flex items-center rounded-full bg-[var(--accent)]/15 px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">
                  {s.percentReduction.toFixed(0)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
