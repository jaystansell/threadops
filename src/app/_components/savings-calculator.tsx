"use client";

import { useState, useMemo } from "react";

type ModelTier = "budget" | "standard" | "premium";

const MODEL_PRICING: Record<ModelTier, { label: string; costPerMTok: number; models: string }> = {
  budget:   { label: "Budget",   costPerMTok: 3,  models: "Haiku 4.5 / GPT-5.4 mini" },
  standard: { label: "Standard", costPerMTok: 9,  models: "Sonnet 4.6 / GPT-5.4" },
  premium:  { label: "Premium",  costPerMTok: 16, models: "Opus 4.8 / GPT-5.5" },
};

const TOKENS_PER_MESSAGE = 500;
const SUMMARY_TOKENS = 500;

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function formatDollars(n: number): string {
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

interface CalculatorResults {
  tokensWithout: number;
  tokensWith: number;
  monthlyCostWithout: number;
  monthlyCostWith: number;
  monthlySavings: number;
  annualSavings: number;
  percentReduction: number;
}

export function SavingsCalculator({ compact = false }: { compact?: boolean }) {
  const [agents, setAgents] = useState(5);
  const [threadsPerDay, setThreadsPerDay] = useState(50);
  const [messagesPerThread, setMessagesPerThread] = useState(50);
  const [modelTier, setModelTier] = useState<ModelTier>("standard");
  const [interactionsPerThread, setInteractionsPerThread] = useState(10);

  const results: CalculatorResults = useMemo(() => {
    const rawTokensPerThread = messagesPerThread * TOKENS_PER_MESSAGE;
    const dailyTokensWithout = threadsPerDay * rawTokensPerThread * interactionsPerThread * agents;
    const dailyTokensWith = threadsPerDay * SUMMARY_TOKENS * interactionsPerThread * agents;

    const monthlyTokensWithout = dailyTokensWithout * 30;
    const monthlyTokensWith = dailyTokensWith * 30;

    const costPerToken = MODEL_PRICING[modelTier].costPerMTok / 1_000_000;
    const monthlyCostWithout = monthlyTokensWithout * costPerToken;
    const monthlyCostWith = monthlyTokensWith * costPerToken;
    const monthlySavings = monthlyCostWithout - monthlyCostWith;
    const annualSavings = monthlySavings * 12;
    const percentReduction = monthlyTokensWithout > 0
      ? ((monthlyTokensWithout - monthlyTokensWith) / monthlyTokensWithout) * 100
      : 0;

    return {
      tokensWithout: monthlyTokensWithout,
      tokensWith: monthlyTokensWith,
      monthlyCostWithout,
      monthlyCostWith,
      monthlySavings,
      annualSavings,
      percentReduction,
    };
  }, [agents, threadsPerDay, messagesPerThread, modelTier, interactionsPerThread]);

  const barMaxWidth = results.monthlyCostWithout || 1;

  return (
    <div className={`rounded-2xl border border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-sm ${compact ? "p-6" : "p-8"}`}>
      {!compact && (
        <div className="mb-8">
          <h3 className="text-xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
            Token Savings Calculator
          </h3>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            See how much Threadzy saves on context tokens and cost.
          </p>
        </div>
      )}

      <div className={`grid gap-6 ${compact ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-5"}`}>
        <SliderInput
          label="Agents"
          value={agents}
          onChange={setAgents}
          min={1}
          max={50}
          step={1}
        />
        <SliderInput
          label="Threads / day"
          value={threadsPerDay}
          onChange={setThreadsPerDay}
          min={1}
          max={500}
          step={1}
        />
        <SliderInput
          label="Messages / thread"
          value={messagesPerThread}
          onChange={setMessagesPerThread}
          min={5}
          max={200}
          step={5}
        />
        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-2">
            Model Tier
          </label>
          <select
            value={modelTier}
            onChange={(e) => setModelTier(e.target.value as ModelTier)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            {Object.entries(MODEL_PRICING).map(([key, { label, models }]) => (
              <option key={key} value={key}>
                {label} ({models})
              </option>
            ))}
          </select>
        </div>
        <SliderInput
          label="Interactions / thread / day"
          value={interactionsPerThread}
          onChange={setInteractionsPerThread}
          min={1}
          max={50}
          step={1}
        />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ResultCard
          label="Monthly cost without"
          value={formatDollars(results.monthlyCostWithout)}
          sub={`${formatNumber(results.tokensWithout)} tokens`}
          variant="muted"
        />
        <ResultCard
          label="Monthly cost with Threadzy"
          value={formatDollars(results.monthlyCostWith)}
          sub={`${formatNumber(results.tokensWith)} tokens`}
          variant="accent"
        />
        <ResultCard
          label="Monthly savings"
          value={formatDollars(results.monthlySavings)}
          sub={`${results.percentReduction.toFixed(0)}% reduction`}
          variant="accent"
        />
        <ResultCard
          label="Annual savings"
          value={formatDollars(results.annualSavings)}
          sub="projected yearly"
          variant="highlight"
        />
      </div>

      {/* Cost comparison bar */}
      <div className="mt-6 space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[var(--muted-foreground)]">Without Threadzy</span>
            <span className="font-mono text-[var(--foreground)]">{formatDollars(results.monthlyCostWithout)}/mo</span>
          </div>
          <div className="h-6 rounded-lg bg-[var(--muted)] overflow-hidden">
            <div
              className="h-full rounded-lg bg-[var(--destructive)]/60 transition-all duration-500"
              style={{ width: "100%" }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[var(--muted-foreground)]">With Threadzy</span>
            <span className="font-mono text-[var(--accent)]">{formatDollars(results.monthlyCostWith)}/mo</span>
          </div>
          <div className="h-6 rounded-lg bg-[var(--muted)] overflow-hidden">
            <div
              className="h-full rounded-lg bg-[var(--accent)] transition-all duration-500"
              style={{ width: `${(results.monthlyCostWith / barMaxWidth) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-2">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-[var(--accent)] h-1.5"
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v >= min && v <= max) onChange(v);
          }}
          className="w-16 rounded-lg border border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)] px-2 py-1.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>
    </div>
  );
}

function ResultCard({
  label,
  value,
  sub,
  variant,
}: {
  label: string;
  value: string;
  sub: string;
  variant: "muted" | "accent" | "highlight";
}) {
  const borderClass =
    variant === "highlight"
      ? "border-[var(--accent)] bg-[var(--accent)]/10"
      : variant === "accent"
        ? "border-[var(--accent)]/40 bg-[var(--muted)]"
        : "border-[var(--border)] bg-[var(--muted)]";

  return (
    <div className={`rounded-xl border ${borderClass} p-4`}>
      <p className="text-xs text-[var(--muted-foreground)] mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${variant === "highlight" ? "text-[var(--accent)]" : ""}`}>
        {value}
      </p>
      <p className="text-xs text-[var(--muted-foreground)] mt-1">{sub}</p>
    </div>
  );
}
