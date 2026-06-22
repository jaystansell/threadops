"use client";

import { useState, useMemo } from "react";

type ModelTier = "budget" | "standard" | "premium";
type Baseline = "raw" | "platform";

const MODEL_PRICING: Record<ModelTier, { label: string; costPerMTok: number; models: string }> = {
  budget:   { label: "Budget",   costPerMTok: 3,  models: "Haiku 4.5 / GPT-5.4 mini" },
  standard: { label: "Standard", costPerMTok: 9,  models: "Sonnet 4.6 / GPT-5.4" },
  premium:  { label: "Premium",  costPerMTok: 16, models: "Opus 4.8 / GPT-5.5" },
};

const TOKENS_PER_MESSAGE = 500;
const SUMMARY_TOKENS = 500;
const TOOL_OVERHEAD = 500;
const PLATFORM_SUMMARY_TOKENS = 10_000;
const HOURLY_RATE = 100_000 / 2_080;
const THREADZY_COST_PER_AGENT_MONTH = 25;

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function formatDollars(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

interface CalculatorResults {
  tokensWithout: number;
  tokensWith: number;
  monthlyCostWithout: number;
  monthlyCostWith: number;
  monthlySavings: number;
  annualSavings: number;
  percentReduction: number;
  humanMinutesSaved: number;
  humanDollarsSavedMonthly: number;
  humanDollarsSavedAnnual: number;
  totalMonthly: number;
  totalAnnual: number;
  threadzyPlanMonthly: number;
  threadzyPlanAnnual: number;
  netMonthly: number;
  netAnnual: number;
}

export function SavingsCalculator({ hideHeader = false }: { hideHeader?: boolean }) {
  const [agents, setAgents] = useState(3);
  const [threadsPerDay, setThreadsPerDay] = useState(20);
  const [messagesPerThread, setMessagesPerThread] = useState(30);
  const [modelTier, setModelTier] = useState<ModelTier>("standard");
  const [interactionsPerThread, setInteractionsPerThread] = useState(2);
  const [baseline, setBaseline] = useState<Baseline>("platform");
  const [minutesSavedPerDay, setMinutesSavedPerDay] = useState(30);

  const results: CalculatorResults = useMemo(() => {
    const baselineTokens = baseline === "raw"
      ? messagesPerThread * TOKENS_PER_MESSAGE
      : PLATFORM_SUMMARY_TOKENS;

    const threadzyTokens = SUMMARY_TOKENS + TOOL_OVERHEAD;

    const dailyTokensWithout = threadsPerDay * baselineTokens * interactionsPerThread * agents;
    const dailyTokensWith = threadsPerDay * threadzyTokens * interactionsPerThread * agents;

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

    const hoursPerMonth = (minutesSavedPerDay * 22) / 60;
    const humanDollarsSavedMonthly = hoursPerMonth * HOURLY_RATE;
    const humanDollarsSavedAnnual = humanDollarsSavedMonthly * 12;

    const threadzyPlanMonthly = agents * THREADZY_COST_PER_AGENT_MONTH;
    const threadzyPlanAnnual = threadzyPlanMonthly * 12;
    const totalMonthlyGross = monthlySavings + humanDollarsSavedMonthly;
    const totalAnnualGross = annualSavings + humanDollarsSavedAnnual;

    return {
      tokensWithout: monthlyTokensWithout,
      tokensWith: monthlyTokensWith,
      monthlyCostWithout,
      monthlyCostWith,
      monthlySavings,
      annualSavings,
      percentReduction,
      humanMinutesSaved: minutesSavedPerDay * 22,
      humanDollarsSavedMonthly,
      humanDollarsSavedAnnual,
      totalMonthly: totalMonthlyGross,
      totalAnnual: totalAnnualGross,
      threadzyPlanMonthly,
      threadzyPlanAnnual,
      netMonthly: totalMonthlyGross - threadzyPlanMonthly,
      netAnnual: totalAnnualGross - threadzyPlanAnnual,
    };
  }, [agents, threadsPerDay, messagesPerThread, modelTier, interactionsPerThread, baseline, minutesSavedPerDay]);

  const barMaxWidth = results.monthlyCostWithout || 1;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-sm p-8">
      {!hideHeader && (
        <div className="mb-8">
          <h3 className="text-xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
            Savings Calculator
          </h3>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Model your setup to see projected token and human time savings.
            Includes tool call overhead on the Threadzy side.
          </p>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
        {baseline === "raw" && (
          <SliderInput
            label="Messages / thread"
            value={messagesPerThread}
            onChange={setMessagesPerThread}
            min={5}
            max={200}
            step={5}
          />
        )}
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
          max={20}
          step={1}
        />
        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-2">
            Compare against
          </label>
          <select
            value={baseline}
            onChange={(e) => setBaseline(e.target.value as Baseline)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="platform">Platform summarization (~10K tok)</option>
            <option value="raw">Raw replay (no summarization)</option>
          </select>
        </div>
      </div>

      <div className="mt-6">
        <SliderInput
          label="Human time saved (min/day on thread management)"
          value={minutesSavedPerDay}
          onChange={setMinutesSavedPerDay}
          min={0}
          max={120}
          step={5}
        />
      </div>

      {/* Token savings */}
      <div className="mt-8">
        <p className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-4 font-mono">
          Token savings
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ResultCard
            label={baseline === "raw" ? "Raw replay cost" : "Platform summary cost"}
            value={formatDollars(results.monthlyCostWithout)}
            sub={`${formatNumber(results.tokensWithout)} tokens/mo`}
            variant="muted"
          />
          <ResultCard
            label="Threadzy cost (incl. overhead)"
            value={formatDollars(results.monthlyCostWith)}
            sub={`${formatNumber(results.tokensWith)} tokens/mo`}
            variant="accent"
          />
          <ResultCard
            label="Monthly token savings"
            value={formatDollars(results.monthlySavings)}
            sub={`${results.percentReduction.toFixed(0)}% reduction`}
            variant="accent"
          />
          <ResultCard
            label="Annual token savings"
            value={formatDollars(results.annualSavings)}
            sub="projected yearly"
            variant="accent"
          />
        </div>
      </div>

      {/* Human time savings */}
      <div className="mt-6">
        <p className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-4 font-mono">
          Human time savings ($100K/yr salary)
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <ResultCard
            label="Hours saved / month"
            value={`${(results.humanMinutesSaved / 60).toFixed(1)} hrs`}
            sub={`${minutesSavedPerDay} min/day x 22 days`}
            variant="muted"
          />
          <ResultCard
            label="Monthly time value"
            value={formatDollars(results.humanDollarsSavedMonthly)}
            sub="at $48.08/hr"
            variant="accent"
          />
          <ResultCard
            label="Annual time value"
            value={formatDollars(results.humanDollarsSavedAnnual)}
            sub="projected yearly"
            variant="accent"
          />
        </div>
      </div>

      {/* Combined total */}
      <div className="mt-6">
        <p className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-4 font-mono">
          Combined value (tokens + human time)
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ResultCard
            label="Gross monthly savings"
            value={formatDollars(results.totalMonthly)}
            sub={`${formatDollars(results.monthlySavings)} tokens + ${formatDollars(results.humanDollarsSavedMonthly)} time`}
            variant="highlight"
          />
          <ResultCard
            label="Threadzy plan cost"
            value={formatDollars(results.threadzyPlanMonthly)}
            sub={`${agents} agent${agents !== 1 ? "s" : ""} x $25/mo`}
            variant="muted"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 mt-4">
          <ResultCard
            label="Net monthly ROI"
            value={formatDollars(results.netMonthly)}
            sub="after Threadzy plan cost"
            variant="highlight"
          />
          <ResultCard
            label="Net annual ROI"
            value={formatDollars(results.netAnnual)}
            sub={`${formatDollars(results.totalAnnual)} gross − ${formatDollars(results.threadzyPlanAnnual)} plan`}
            variant="highlight"
          />
        </div>
      </div>

      {/* Cost comparison bar */}
      <div className="mt-6 space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[var(--muted-foreground)]">
              {baseline === "raw" ? "Reconstruction cost (raw replay)" : "Reconstruction cost (platform summary)"}
            </span>
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
            <span className="text-[var(--muted-foreground)]">With Threadzy (incl. ~500 tok tool overhead)</span>
            <span className="font-mono text-[var(--accent)]">{formatDollars(results.monthlyCostWith)}/mo</span>
          </div>
          <div className="h-6 rounded-lg bg-[var(--muted)] overflow-hidden">
            <div
              className="h-full rounded-lg bg-[var(--accent)] transition-all duration-500"
              style={{ width: `${Math.max((results.monthlyCostWith / barMaxWidth) * 100, 1)}%` }}
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
