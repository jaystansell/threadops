"use client";

import { useRef, useEffect } from "react";

interface BarDatum {
  label: string;
  without: number;
  with: number;
}

function formatDollars(n: number): string {
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
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
              <span className="text-xs text-[var(--muted-foreground)] w-20 shrink-0">Without</span>
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
              <span className="text-xs text-[var(--muted-foreground)] w-20 shrink-0">With Threadzy</span>
              <div className="flex-1 h-7 rounded bg-[var(--muted)] overflow-hidden">
                <div
                  className="h-full rounded bg-[var(--accent)] flex items-center px-2 transition-all duration-700"
                  style={{ width: `${(d.with / max) * 100}%` }}
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
            <th className="text-right py-3 px-4 text-[var(--muted-foreground)] font-medium">Token Reduction</th>
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

export function TokenBreakdownChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const padding = { top: 40, right: 20, bottom: 60, left: 70 };

    const agents = [1, 5, 10, 20];
    const tokensWithout = agents.map((a) => a * 50 * 50 * 500 * 10);
    const tokensWith = agents.map((a) => a * 50 * 500 * 10);

    const maxVal = Math.max(...tokensWithout);
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    const barGroupW = chartW / agents.length;
    const barW = barGroupW * 0.3;

    // background
    ctx.fillStyle = "transparent";
    ctx.clearRect(0, 0, w, h);

    // grid lines
    ctx.strokeStyle = "rgba(30, 41, 59, 0.6)";
    ctx.lineWidth = 1;
    const gridSteps = 5;
    for (let i = 0; i <= gridSteps; i++) {
      const y = padding.top + (chartH / gridSteps) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      const val = maxVal - (maxVal / gridSteps) * i;
      ctx.fillStyle = "#94A3B8";
      ctx.font = "11px monospace";
      ctx.textAlign = "right";
      ctx.fillText(formatTokens(val), padding.left - 8, y + 4);
    }

    // bars
    agents.forEach((agent, i) => {
      const x = padding.left + barGroupW * i + barGroupW * 0.15;

      // without bar
      const h1 = (tokensWithout[i] / maxVal) * chartH;
      ctx.fillStyle = "rgba(239, 68, 68, 0.5)";
      ctx.beginPath();
      ctx.roundRect(x, padding.top + chartH - h1, barW, h1, [4, 4, 0, 0]);
      ctx.fill();

      // with bar
      const h2 = (tokensWith[i] / maxVal) * chartH;
      ctx.fillStyle = "rgba(20, 184, 166, 0.9)";
      ctx.beginPath();
      ctx.roundRect(x + barW + 4, padding.top + chartH - h2, barW, h2, [4, 4, 0, 0]);
      ctx.fill();

      // label
      ctx.fillStyle = "#94A3B8";
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(
        `${agent} agent${agent > 1 ? "s" : ""}`,
        x + barW + 2,
        h - padding.bottom + 20
      );
    });

    // title
    ctx.fillStyle = "#F1F5F9";
    ctx.font = "bold 13px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("Daily tokens by agent count (50 threads/day, 10 interactions)", padding.left, 20);

    // legend
    const legendX = w - padding.right - 160;
    ctx.fillStyle = "rgba(239, 68, 68, 0.5)";
    ctx.fillRect(legendX, 10, 12, 12);
    ctx.fillStyle = "#94A3B8";
    ctx.font = "11px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("Without Threadzy", legendX + 18, 20);

    ctx.fillStyle = "rgba(20, 184, 166, 0.9)";
    ctx.fillRect(legendX + 130, 10, 12, 12);
    ctx.fillStyle = "#94A3B8";
    ctx.fillText("With", legendX + 148, 20);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height: "360px" }}
    />
  );
}
