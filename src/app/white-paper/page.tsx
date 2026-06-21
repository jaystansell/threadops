import type { Metadata } from "next";
import Link from "next/link";
import { SavingsCalculator } from "../_components/savings-calculator";
import { TokenComparisonChart, SavingsSummaryTable, TokenBreakdownChart } from "./charts";

export const metadata: Metadata = {
  title: "White Paper — The Hidden Cost of Agent Context",
  description:
    "How Threadzy eliminates context reconstruction overhead, saving tokens, dollars, and human time.",
};

const TOKENS_PER_MSG = 500;
const SUMMARY_TOKENS = 500;
const INTERACTIONS = 10;

function scenario(
  label: string,
  agents: number,
  threadsPerDay: number,
  messagesPerThread: number,
  costPerMTok: number,
) {
  const rawPerThread = messagesPerThread * TOKENS_PER_MSG;
  const dailyWithout = threadsPerDay * rawPerThread * INTERACTIONS * agents;
  const dailyWith = threadsPerDay * SUMMARY_TOKENS * INTERACTIONS * agents;
  const monthlyWithout = dailyWithout * 30;
  const monthlyWith = dailyWith * 30;
  const costPer = costPerMTok / 1_000_000;
  const monthlyCostWithout = monthlyWithout * costPer;
  const monthlyCostWith = monthlyWith * costPer;
  return {
    label,
    without: monthlyCostWithout,
    with: monthlyCostWith,
    monthlySavings: monthlyCostWithout - monthlyCostWith,
    annualSavings: (monthlyCostWithout - monthlyCostWith) * 12,
    percentReduction:
      ((monthlyWithout - monthlyWith) / monthlyWithout) * 100,
  };
}

const budgetScenarios = [
  scenario("Solo dev — 1 agent, 10 threads/day", 1, 10, 50, 3),
  scenario("Small team — 5 agents, 50 threads/day", 5, 50, 50, 3),
  scenario("Enterprise — 20 agents, 200 threads/day", 20, 200, 50, 3),
];

const standardScenarios = [
  scenario("Solo dev — 1 agent, 10 threads/day", 1, 10, 50, 9),
  scenario("Small team — 5 agents, 50 threads/day", 5, 50, 50, 9),
  scenario("Enterprise — 20 agents, 200 threads/day", 20, 200, 50, 9),
];

const premiumScenarios = [
  scenario("Solo dev — 1 agent, 10 threads/day", 1, 10, 50, 16),
  scenario("Small team — 5 agents, 50 threads/day", 5, 50, 50, 16),
  scenario("Enterprise — 20 agents, 200 threads/day", 20, 200, 50, 16),
];

export default function WhitePaperPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-16 text-center">
        <p className="text-xs uppercase tracking-widest text-[var(--accent)] font-mono mb-4">
          White Paper — June 2026
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight mb-4">
          The Hidden Cost of Agent Context:
          <br />
          <span className="text-[var(--accent)]">
            How Threadzy Saves Tokens and Time
          </span>
        </h1>
        <p className="text-[var(--muted-foreground)] max-w-2xl mx-auto">
          AI agents spend tokens reconstructing context they already processed.
          This white paper quantifies that overhead and shows how structured
          working memory eliminates it.
        </p>
      </div>

      {/* Table of Contents */}
      <nav className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-6 mb-12">
        <p className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-3 font-mono">
          Contents
        </p>
        <ol className="space-y-1 text-sm">
          <li>
            <a href="#problem" className="text-[var(--accent)] hover:underline">
              1. The Problem
            </a>
          </li>
          <li>
            <a href="#solution" className="text-[var(--accent)] hover:underline">
              2. The Threadzy Solution
            </a>
          </li>
          <li>
            <a href="#token-savings" className="text-[var(--accent)] hover:underline">
              3. Token Savings Model
            </a>
          </li>
          <li>
            <a href="#time-savings" className="text-[var(--accent)] hover:underline">
              4. Time Savings
            </a>
          </li>
          <li>
            <a href="#roi" className="text-[var(--accent)] hover:underline">
              5. ROI Summary
            </a>
          </li>
          <li>
            <a href="#calculator" className="text-[var(--accent)] hover:underline">
              6. Interactive Calculator
            </a>
          </li>
        </ol>
      </nav>

      {/* Section 1: The Problem */}
      <section id="problem" className="mb-16">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center text-sm font-bold shrink-0">
            1
          </span>
          The Problem
        </h2>

        <div className="space-y-4 text-[var(--muted-foreground)] leading-relaxed">
          <p>
            Every time an AI agent is invoked, it needs context about what
            happened before. Without external memory, agents reconstruct this
            context by re-reading raw conversation history. This is the
            context reconstruction overhead.
          </p>

          <p>
            Agents still use tokens for their system prompt, tool calls, and
            new messages. That cost stays the same. The waste is in the
            reconstruction: re-reading 25,000+ tokens of history that the
            agent already processed in a previous invocation.
          </p>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-6 my-6">
            <p className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-3 font-mono">
              Context reconstruction cost
            </p>
            <div className="space-y-2 font-mono text-sm">
              <p className="text-[var(--foreground)]">
                50 messages &times; 500 tokens/message ={" "}
                <span className="text-[var(--accent)] font-bold">
                  25,000 tokens of reconstruction per turn
                </span>
              </p>
              <p className="text-[var(--foreground)]">
                10 turns/day &times; 5 agents ={" "}
                <span className="text-[var(--accent)] font-bold">
                  1.25M tokens/day
                </span>{" "}
                spent on reconstruction alone
              </p>
              <p className="text-[var(--foreground)]">
                30 days/month ={" "}
                <span className="text-[var(--accent)] font-bold">
                  37.5M tokens/month
                </span>{" "}
                of pure overhead
              </p>
            </div>
          </div>

          <p>
            These are input tokens spent re-reading what the agent already
            processed. They carry zero new information. The cost grows
            linearly with thread length, agent count, and interaction
            frequency.
          </p>
        </div>
      </section>

      {/* Section 2: The Solution */}
      <section id="solution" className="mb-16">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center text-sm font-bold shrink-0">
            2
          </span>
          The Threadzy Solution
        </h2>

        <div className="space-y-4 text-[var(--muted-foreground)] leading-relaxed">
          <p>
            Threadzy does not replace the agent&apos;s own context window. Agents
            still have their system prompt, workspace knowledge, and current
            conversation. What Threadzy eliminates is the reconstruction
            overhead: the tokens spent re-reading history to figure out
            what happened before.
          </p>

          <p>
            Instead of loading 25,000 tokens of raw messages, the agent
            queries Threadzy for a ~500-token structured summary that
            captures key decisions, action items, and current status.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 my-6">
            <div className="rounded-xl border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 p-5">
              <p className="text-sm font-bold text-[var(--destructive)] mb-2">
                Without Threadzy
              </p>
              <ul className="space-y-1.5 text-sm">
                <li>Reconstruct context by re-reading 50+ messages</li>
                <li>25,000+ tokens of reconstruction overhead per turn</li>
                <li>No structure, no filtering, no metadata</li>
                <li>Reconstruction cost scales with thread length</li>
              </ul>
            </div>
            <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-5">
              <p className="text-sm font-bold text-[var(--accent)] mb-2">
                With Threadzy
              </p>
              <ul className="space-y-1.5 text-sm">
                <li>Query a ~500-token structured summary</li>
                <li>Tags, status, and metadata for instant context</li>
                <li>Agents load only relevant threads</li>
                <li>Reconstruction cost drops to near zero</li>
              </ul>
            </div>
          </div>

          <p>
            Summaries are maintained automatically as messages are added.
            Tags and metadata provide instant context without reading any
            content at all. The agent&apos;s own context window is freed up for
            the actual work.
          </p>
        </div>
      </section>

      {/* Section 3: Token Savings Model */}
      <section id="token-savings" className="mb-16">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center text-sm font-bold shrink-0">
            3
          </span>
          Token Savings Model
        </h2>

        <div className="space-y-4 text-[var(--muted-foreground)] leading-relaxed">
          <p>
            The savings below represent context reconstruction overhead
            eliminated by Threadzy. This is the cost of re-reading conversation
            history that agents no longer need to pay. All scenarios assume 50
            messages per thread and 10 agent interactions per thread per day.
          </p>

          {/* Pricing reference */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5 my-6">
            <p className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-3 font-mono">
              Model pricing (June 2026, blended input/output)
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="text-center">
                <p className="text-lg font-bold font-mono">$3<span className="text-sm text-[var(--muted-foreground)]">/MTok</span></p>
                <p className="text-xs text-[var(--muted-foreground)]">Budget — Haiku 4.5 / GPT-5.4 mini</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold font-mono">$9<span className="text-sm text-[var(--muted-foreground)]">/MTok</span></p>
                <p className="text-xs text-[var(--muted-foreground)]">Standard — Sonnet 4.6 / GPT-5.4</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold font-mono">$15–18<span className="text-sm text-[var(--muted-foreground)]">/MTok</span></p>
                <p className="text-xs text-[var(--muted-foreground)]">Premium — Opus 4.8 / GPT-5.5</p>
              </div>
            </div>
          </div>

          {/* Canvas chart */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4 my-8">
            <TokenBreakdownChart />
          </div>

          {/* Budget tier */}
          <h3 className="text-lg font-bold mt-8 mb-4">
            Budget Tier ($3/MTok)
          </h3>
          <TokenComparisonChart
            data={budgetScenarios.map((s) => ({
              label: s.label,
              without: s.without,
              with: s.with,
            }))}
          />
          <div className="mt-4">
            <SavingsSummaryTable scenarios={budgetScenarios} />
          </div>

          {/* Standard tier */}
          <h3 className="text-lg font-bold mt-10 mb-4">
            Standard Tier ($9/MTok)
          </h3>
          <TokenComparisonChart
            data={standardScenarios.map((s) => ({
              label: s.label,
              without: s.without,
              with: s.with,
            }))}
          />
          <div className="mt-4">
            <SavingsSummaryTable scenarios={standardScenarios} />
          </div>

          {/* Premium tier */}
          <h3 className="text-lg font-bold mt-10 mb-4">
            Premium Tier ($15–18/MTok)
          </h3>
          <TokenComparisonChart
            data={premiumScenarios.map((s) => ({
              label: s.label,
              without: s.without,
              with: s.with,
            }))}
          />
          <div className="mt-4">
            <SavingsSummaryTable scenarios={premiumScenarios} />
          </div>
        </div>
      </section>

      {/* Section 4: Time Savings */}
      <section id="time-savings" className="mb-16">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center text-sm font-bold shrink-0">
            4
          </span>
          Time Savings
        </h2>

        <div className="space-y-4 text-[var(--muted-foreground)] leading-relaxed">
          <p>
            Token cost is only half the story. Human time spent managing agent
            threads is significant and often unmeasured. At a $100K/year
            salary (~$48/hr), even small daily time savings add up fast.
          </p>

          <div className="grid gap-4 sm:grid-cols-3 my-6">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5 text-center">
              <p className="text-3xl font-bold font-mono text-[var(--accent)]">30–60</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                min/day saved on manual triage
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                (teams with 10+ agents)
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5 text-center">
              <p className="text-3xl font-bold font-mono text-[var(--accent)]">15–20</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                hrs/month saved on context switching
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5 text-center">
              <p className="text-3xl font-bold font-mono text-[var(--accent)]">Zero</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                manual tagging or thread organization
              </p>
            </div>
          </div>

          {/* Dollar value of time saved */}
          <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-5 my-6">
            <p className="text-xs uppercase tracking-widest text-[var(--accent)] mb-3 font-mono">
              Human time value ($100K/year = $48/hr)
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="text-center">
                <p className="text-xs text-[var(--muted-foreground)] mb-1">Solo dev (5 hrs/mo)</p>
                <p className="text-lg font-bold font-mono text-[var(--accent)]">$240</p>
                <p className="text-xs text-[var(--muted-foreground)]">per month</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-[var(--muted-foreground)] mb-1">Small team (15 hrs/mo)</p>
                <p className="text-lg font-bold font-mono text-[var(--accent)]">$720</p>
                <p className="text-xs text-[var(--muted-foreground)]">per month</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-[var(--muted-foreground)] mb-1">Enterprise (40 hrs/mo)</p>
                <p className="text-lg font-bold font-mono text-[var(--accent)]">$1,920</p>
                <p className="text-xs text-[var(--muted-foreground)]">per month</p>
              </div>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] text-center mt-3">
              Annual human time value: $2,880 / $8,640 / $23,040
            </p>
          </div>

          <p>
            Without Threadzy, humans must manually scroll through agent
            conversations, tag relevant threads, maintain context across
            multiple agent platforms, and answer the same question repeatedly
            because agents forgot. Threadzy eliminates all of this.
          </p>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5 my-6">
            <p className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-3 font-mono">
              What Threadzy replaces
            </p>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-[var(--destructive)] mt-0.5">✕</span>
                <span>Scrolling through 200-message threads to find decisions</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[var(--accent)] mt-0.5">→</span>
                <span>Structured summaries with key decisions highlighted</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[var(--destructive)] mt-0.5">✕</span>
                <span>Manually tagging and categorizing agent output</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[var(--accent)] mt-0.5">→</span>
                <span>Auto-tagged threads with filterable metadata</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[var(--destructive)] mt-0.5">✕</span>
                <span>Switching between 5 different agent UIs</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[var(--accent)] mt-0.5">→</span>
                <span>One dashboard for all agents</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[var(--destructive)] mt-0.5">✕</span>
                <span>Re-explaining context after agent memory resets</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[var(--accent)] mt-0.5">→</span>
                <span>Persistent state that survives context resets</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: ROI Summary */}
      <section id="roi" className="mb-16">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center text-sm font-bold shrink-0">
            5
          </span>
          ROI Summary
        </h2>

        <div className="space-y-4 text-[var(--muted-foreground)] leading-relaxed">
          <p>
            Threadzy is free during the early access period. Even when pricing
            is introduced, the combined token and time savings produce
            immediate ROI. All figures below use standard tier ($9/MTok)
            and $100K/year salary ($48/hr).
          </p>

          <div className="grid gap-4 sm:grid-cols-3 my-6">
            {[
              { label: "Solo developer", tokenSavings: standardScenarios[0].annualSavings, timeHrs: 5, timeAnnual: 2880 },
              { label: "Small team", tokenSavings: standardScenarios[1].annualSavings, timeHrs: 15, timeAnnual: 8640 },
              { label: "Enterprise", tokenSavings: standardScenarios[2].annualSavings, timeHrs: 40, timeAnnual: 23040 },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-[var(--accent)] bg-[var(--accent)]/10 p-6 text-center">
                <p className="text-xs uppercase tracking-widest text-[var(--accent)] mb-2 font-mono">
                  {s.label}
                </p>
                <p className="text-2xl font-bold font-mono text-[var(--foreground)]">
                  {s.tokenSavings >= 1000
                    ? `$${(s.tokenSavings / 1000).toFixed(1)}K`
                    : `$${s.tokenSavings.toFixed(0)}`}
                </p>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  annual token savings
                </p>
                <p className="text-xs text-[var(--accent)] mt-2">
                  + ${s.timeAnnual.toLocaleString()}/yr in time savings
                </p>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  ({s.timeHrs} hrs/mo at $48/hr)
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5">
            <p className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-3 font-mono">
              Key takeaways
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)] font-bold shrink-0">98%</span>
                <span>reduction in context reconstruction overhead</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)] font-bold shrink-0">Day 1</span>
                <span>payback. Threadzy is free, so savings begin immediately</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)] font-bold shrink-0">Linear</span>
                <span>scaling. Savings multiply with every agent and thread you add</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)] font-bold shrink-0">2x</span>
                <span>value when combining token savings with human time savings</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Section 6: Interactive Calculator */}
      <section id="calculator" className="mb-16">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center text-sm font-bold shrink-0">
            6
          </span>
          Calculate Your Savings
        </h2>
        <p className="text-[var(--muted-foreground)] mb-6">
          Adjust the inputs below to model your own agent workload and see
          projected savings.
        </p>
        <SavingsCalculator />
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-[var(--accent)] bg-[var(--accent)]/10 p-8 text-center">
        <h2 className="text-2xl font-bold mb-3">
          Start saving tokens today
        </h2>
        <p className="text-[var(--muted-foreground)] mb-6 max-w-xl mx-auto">
          Threadzy is free during early access. Connect your first agent in
          under 5 minutes and stop paying to reconstruct context your agents
          already have.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="px-6 py-3 text-sm font-semibold rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
          >
            Sign Up Free
          </Link>
          <Link
            href="/docs/api"
            className="px-6 py-3 text-sm font-semibold rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
          >
            API Docs
          </Link>
        </div>
      </section>
    </div>
  );
}
