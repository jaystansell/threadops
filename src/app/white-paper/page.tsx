import type { Metadata } from "next";
import Link from "next/link";
import { SavingsCalculator } from "../_components/savings-calculator";
import { TokenComparisonChart, SavingsSummaryTable } from "./charts";

export const metadata: Metadata = {
  title: "White Paper — The Real Cost of Managing AI Agents",
  description:
    "How Threadzy eliminates thread hunting, context chaos, and reconstruction overhead for teams running AI agents.",
};

const TOKENS_PER_MSG = 500;
const SUMMARY_TOKENS = 500;
const TOOL_OVERHEAD = 500;
const INTERACTIONS = 2;

const PLATFORM_SUMMARY_TOKENS = 10_000;

function scenario(
  label: string,
  agents: number,
  threadsPerDay: number,
  messagesPerThread: number,
  costPerMTok: number,
) {
  const rawPerThread = messagesPerThread * TOKENS_PER_MSG;
  const platformSummary = PLATFORM_SUMMARY_TOKENS;

  const dailyRaw = threadsPerDay * rawPerThread * INTERACTIONS * agents;
  const dailyPlatform = threadsPerDay * platformSummary * INTERACTIONS * agents;
  const dailyThreadzy = threadsPerDay * (SUMMARY_TOKENS + TOOL_OVERHEAD) * INTERACTIONS * agents;

  const monthlyRaw = dailyRaw * 30;
  const monthlyPlatform = dailyPlatform * 30;
  const monthlyThreadzy = dailyThreadzy * 30;

  const costPer = costPerMTok / 1_000_000;

  const monthlyCostRaw = monthlyRaw * costPer;
  const monthlyCostPlatform = monthlyPlatform * costPer;
  const monthlyCostThreadzy = monthlyThreadzy * costPer;

  return {
    label,
    withoutRaw: monthlyCostRaw,
    withoutPlatform: monthlyCostPlatform,
    withThreadzy: monthlyCostThreadzy,
    monthlySavingsVsRaw: monthlyCostRaw - monthlyCostThreadzy,
    monthlySavingsVsPlatform: monthlyCostPlatform - monthlyCostThreadzy,
    annualSavingsVsPlatform: (monthlyCostPlatform - monthlyCostThreadzy) * 12,
    percentVsRaw: ((monthlyRaw - monthlyThreadzy) / monthlyRaw) * 100,
    percentVsPlatform: ((monthlyPlatform - monthlyThreadzy) / monthlyPlatform) * 100,
  };
}

const standardScenarios = [
  scenario("Solo operator, 1 agent, 10 threads/day", 1, 10, 30, 9),
  scenario("Small team, 5 agents, 30 threads/day", 5, 30, 30, 9),
  scenario("Scaling team, 15 agents, 100 threads/day", 15, 100, 30, 9),
];

const HOURLY_RATE = 100_000 / 2_080;

function humanTimeDollars(minutesPerDay: number): {
  monthly: number;
  annual: number;
} {
  const hoursPerMonth = (minutesPerDay * 22) / 60;
  const monthly = hoursPerMonth * HOURLY_RATE;
  return { monthly, annual: monthly * 12 };
}

export default function WhitePaperPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-16 text-center">
        <p className="text-xs uppercase tracking-widest text-[var(--accent)] font-mono mb-4">
          White Paper
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight mb-4">
          The Real Cost of Managing AI Agents:
          <br />
          <span className="text-[var(--accent)]">
            Human Time, Token Waste, and What Threadzy Fixes
          </span>
        </h1>
        <p className="text-[var(--muted-foreground)] max-w-2xl mx-auto">
          Your team spends hours hunting for thread status across agent
          platforms. Your agents burn tokens re-reading conversations they
          already processed. Threadzy eliminates both problems.
        </p>
      </div>

      {/* Table of Contents */}
      <nav className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-6 mb-12">
        <p className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-3 font-mono">
          Contents
        </p>
        <ol className="space-y-1 text-sm">
          <li>
            <a href="#human-problem" className="text-[var(--accent)] hover:underline">
              1. The Human Problem
            </a>
          </li>
          <li>
            <a href="#agent-problem" className="text-[var(--accent)] hover:underline">
              2. The Agent Problem
            </a>
          </li>
          <li>
            <a href="#solution" className="text-[var(--accent)] hover:underline">
              3. How Threadzy Solves Both
            </a>
          </li>
          <li>
            <a href="#who-benefits" className="text-[var(--accent)] hover:underline">
              4. Who Benefits Most
            </a>
          </li>
          <li>
            <a href="#time-savings" className="text-[var(--accent)] hover:underline">
              5. Human Time Savings
            </a>
          </li>
          <li>
            <a href="#token-savings" className="text-[var(--accent)] hover:underline">
              6. Token Savings Model
            </a>
          </li>
          <li>
            <a href="#fidelity" className="text-[var(--accent)] hover:underline">
              7. Information Fidelity
            </a>
          </li>
          <li>
            <a href="#roi" className="text-[var(--accent)] hover:underline">
              8. ROI Summary
            </a>
          </li>
          <li>
            <a href="#calculator" className="text-[var(--accent)] hover:underline">
              9. Interactive Calculator
            </a>
          </li>
        </ol>
      </nav>

      {/* Section 1: The Human Problem */}
      <section id="human-problem" className="mb-16">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center text-sm font-bold shrink-0">
            1
          </span>
          The Human Problem
        </h2>

        <div className="space-y-4 text-[var(--muted-foreground)] leading-relaxed">
          <p className="text-lg text-[var(--foreground)] font-medium">
            People running AI agents spend more time managing them than they
            realize.
          </p>

          <p>
            The work is invisible because it does not feel like &ldquo;work.&rdquo; It
            is scrolling through a chat to find what an agent decided. It is
            switching between three different agent UIs to figure out which one
            handled a task. It is re-explaining context because the agent forgot
            after a memory reset.
          </p>

          <p>
            None of this is the agent doing its job. This is the human doing the
            agent&apos;s bookkeeping.
          </p>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-6 my-6">
            <p className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-4 font-mono">
              Where the time goes
            </p>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-[var(--accent)] font-bold text-lg shrink-0 w-6 text-center">?</span>
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">&ldquo;Where is this at?&rdquo;</p>
                  <p className="text-sm">
                    The most expensive question in agent management. Someone
                    needs a status update. They open the chat, scroll past 200
                    messages, skim for the latest decision, and piece together
                    what happened. Two minutes per lookup, dozens of times a day.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-[var(--accent)] font-bold text-lg shrink-0 w-6 text-center">↔</span>
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">Platform switching</p>
                  <p className="text-sm">
                    Five agents across three platforms. Each has its own UI, its
                    own conversation format, its own way of showing history. The
                    human becomes the integration layer, manually synthesizing
                    context across all of them.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-[var(--accent)] font-bold text-lg shrink-0 w-6 text-center">↻</span>
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">Re-explaining context</p>
                  <p className="text-sm">
                    Agents lose memory after resets, session boundaries, or
                    context pruning. The human re-explains what already happened.
                    This is not productive conversation. This is maintenance.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-[var(--accent)] font-bold text-lg shrink-0 w-6 text-center">🏷</span>
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">Manual triage and organization</p>
                  <p className="text-sm">
                    Without structured thread management, humans become the
                    filing system. They mentally track which threads are active,
                    which need follow-up, and which agents are handling what.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p>
            Most people running agents do not have thread-based conversations
            with them. They have one long chat. Everything lives in that chat.
            Finding anything means scrolling. This is the default experience on
            every major agent platform today.
          </p>
        </div>
      </section>

      {/* Section 2: The Agent Problem */}
      <section id="agent-problem" className="mb-16">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center text-sm font-bold shrink-0">
            2
          </span>
          The Agent Problem
        </h2>

        <div className="space-y-4 text-[var(--muted-foreground)] leading-relaxed">
          <p className="text-lg text-[var(--foreground)] font-medium">
            Agents pay tokens to reconstruct context they already processed.
          </p>

          <p>
            Every time an agent is invoked, it needs to know what happened
            before. Without external structured memory, it reconstructs this by
            re-reading conversation history. This is the context reconstruction
            overhead.
          </p>

          <p>
            The agent still uses tokens for its system prompt, tool calls, and
            new messages. That cost stays the same regardless. The waste is in
            re-reading history the agent already processed in a previous turn.
          </p>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-6 my-6">
            <p className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-3 font-mono">
              An honest look at reconstruction cost
            </p>
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-medium text-[var(--foreground)]">Worst case (no memory infrastructure):</span>{" "}
                The agent re-reads raw messages. A 30-message thread at ~500
                tokens per message means 15,000 tokens of reconstruction per
                invocation.
              </p>
              <p>
                <span className="font-medium text-[var(--foreground)]">Typical case (platform summarization):</span>{" "}
                Most modern agent platforms do some form of conversation
                summarization. A real-world agent on Tasklet, for example,
                carries a ~10,000-12,000 token conversation summary that loads
                on every invocation. This is better than raw replay, but still
                expensive and grows over time.
              </p>
              <p>
                <span className="font-medium text-[var(--foreground)]">With Threadzy:</span>{" "}
                A ~500-token structured summary replaces the reconstruction.
                Plus ~500 tokens of tool call overhead (API spec, request
                formatting, response parsing). Total: ~1,000 tokens per thread
                lookup.
              </p>
            </div>
          </div>

          <p>
            The savings are real, but they depend on your starting point. If
            your agents already have sophisticated memory infrastructure, the
            token savings are smaller. If your agents start cold every session,
            the savings are dramatic. Section 6 models both baselines honestly.
          </p>
        </div>
      </section>

      {/* Section 3: The Threadzy Solution */}
      <section id="solution" className="mb-16">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center text-sm font-bold shrink-0">
            3
          </span>
          How Threadzy Solves Both
        </h2>

        <div className="space-y-4 text-[var(--muted-foreground)] leading-relaxed">
          <p>
            Threadzy is a thread management layer that sits between your humans
            and your agents. It gives both sides what they need without the
            overhead.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 my-6">
            <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-5">
              <p className="text-sm font-bold text-[var(--accent)] mb-3">
                For humans
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--accent)] shrink-0">→</span>
                  <span>One dashboard for all agents. No more switching between platforms.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--accent)] shrink-0">→</span>
                  <span>Structured summaries with status, tags, and key decisions. No more scrolling through 200 messages.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--accent)] shrink-0">→</span>
                  <span>Tags and filtering. Find any thread by topic, status, or agent in seconds.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--accent)] shrink-0">→</span>
                  <span>Cross-agent visibility. See what all your agents are working on in one place.</span>
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-5">
              <p className="text-sm font-bold text-[var(--accent)] mb-3">
                For agents
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--accent)] shrink-0">→</span>
                  <span>Query a ~500-token structured summary instead of re-reading full history.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--accent)] shrink-0">→</span>
                  <span>Tags and metadata provide instant context without reading any content.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--accent)] shrink-0">→</span>
                  <span>Persistent state that survives context resets and session boundaries.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--accent)] shrink-0">→</span>
                  <span>Clean REST API and MCP integration. Works with any agent framework.</span>
                </li>
              </ul>
            </div>
          </div>

          <p>
            Threadzy does not replace the agent&apos;s own context window. Agents
            keep their system prompt, workspace knowledge, and current
            conversation. Threadzy replaces the reconstruction overhead: the
            tokens spent re-reading history to figure out what happened before.
          </p>
        </div>
      </section>

      {/* Section 4: Who Benefits Most */}
      <section id="who-benefits" className="mb-16">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center text-sm font-bold shrink-0">
            4
          </span>
          Who Benefits Most
        </h2>

        <div className="space-y-4 text-[var(--muted-foreground)] leading-relaxed">
          <p>
            Not every team gets the same value from Threadzy. The benefits
            depend on your current setup and how you work with agents.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 my-6">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5">
              <p className="text-sm font-bold text-[var(--foreground)] mb-2">
                Highest value: Teams with no structured agent memory
              </p>
              <p className="text-sm mb-3">
                If your agents start cold every session, re-read raw history,
                and have no external memory system, Threadzy delivers the full
                savings on both the human and token side.
              </p>
              <p className="text-xs text-[var(--accent)] font-mono">
                Token savings: 90%+ reconstruction reduction
              </p>
              <p className="text-xs text-[var(--accent)] font-mono">
                Time savings: 30-60 min/day for teams with 5+ agents
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5">
              <p className="text-sm font-bold text-[var(--foreground)] mb-2">
                Still valuable: Teams with existing memory infrastructure
              </p>
              <p className="text-sm mb-3">
                If your agents already have conversation summarization, SQL
                databases, or filesystem storage, Threadzy&apos;s primary value is
                cross-agent visibility and the human UX layer. Token savings
                are incremental (replacing ~10K summaries with ~1K lookups).
              </p>
              <p className="text-xs text-[var(--accent)] font-mono">
                Token savings: ~90% vs platform summaries
              </p>
              <p className="text-xs text-[var(--accent)] font-mono">
                Time savings: The bigger win. One UI, tags, instant status.
              </p>
            </div>
          </div>

          <p>
            For both segments, the human time savings tend to be the larger
            dollar value. A $100K/year employee spending 30 minutes a day on
            thread management costs ~$6.3K/year in lost productivity. That dwarfs
            most token savings for small-to-medium teams.
          </p>
        </div>
      </section>

      {/* Section 5: Human Time Savings (THE BIG SECTION) */}
      <section id="time-savings" className="mb-16">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center text-sm font-bold shrink-0">
            5
          </span>
          Human Time Savings
        </h2>

        <div className="space-y-4 text-[var(--muted-foreground)] leading-relaxed">
          <p className="text-lg text-[var(--foreground)] font-medium">
            This is where the real ROI lives for most teams.
          </p>

          <p>
            Token savings get the attention because they are easy to measure.
            But the human time cost of managing agents is typically 2-5x larger
            than the token cost for teams with fewer than 20 agents.
          </p>

          <p>
            All time calculations below use a $100K/year salary as the baseline.
            That works out to $48.08/hr based on 2,080 working hours per year.
            Adjust proportionally for your team&apos;s compensation.
          </p>

          {/* Time cost breakdown */}
          <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-6 my-6">
            <p className="text-xs uppercase tracking-widest text-[var(--accent)] mb-4 font-mono">
              Where human time goes (daily estimates)
            </p>
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] items-start">
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">Thread hunting and status checks</p>
                  <p className="text-sm">
                    Opening chats, scrolling to find latest decisions, piecing
                    together what happened overnight. ~2 minutes per lookup.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-[var(--accent)]">10-30 min/day</p>
                </div>
              </div>
              <div className="border-t border-[var(--accent)]/20" />
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] items-start">
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">Platform context switching</p>
                  <p className="text-sm">
                    Moving between different agent UIs. Each switch costs ~3-5
                    minutes of reorientation as you remember where things are
                    and what format this platform uses.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-[var(--accent)]">5-15 min/day</p>
                </div>
              </div>
              <div className="border-t border-[var(--accent)]/20" />
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] items-start">
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">Re-explaining context to agents</p>
                  <p className="text-sm">
                    After memory resets or session boundaries, typing out what
                    the agent used to know. Especially painful for complex
                    multi-step workflows.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-[var(--accent)]">5-15 min/day</p>
                </div>
              </div>
              <div className="border-t border-[var(--accent)]/20" />
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] items-start">
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">Manual triage and mental bookkeeping</p>
                  <p className="text-sm">
                    Keeping track of which threads are active, which need
                    follow-up, and which agents handle which tasks. This often
                    happens unconsciously throughout the day.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-[var(--accent)]">10-20 min/day</p>
                </div>
              </div>
            </div>
          </div>

          {/* Dollar value table */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-6 my-6">
            <p className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-4 font-mono">
              Dollar value of time saved ($100K/yr = $48.08/hr)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-3 px-4 text-[var(--muted-foreground)] font-medium">Team profile</th>
                    <th className="text-right py-3 px-4 text-[var(--muted-foreground)] font-medium">Time saved/day</th>
                    <th className="text-right py-3 px-4 text-[var(--muted-foreground)] font-medium">Monthly value</th>
                    <th className="text-right py-3 px-4 text-[var(--muted-foreground)] font-medium">Annual value</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Solo operator (1-2 agents)", minutes: 15 },
                    { label: "Small team (3-5 agents)", minutes: 30 },
                    { label: "Growing team (5-10 agents)", minutes: 45 },
                    { label: "Scaling team (10-20 agents)", minutes: 60 },
                  ].map((row) => {
                    const savings = humanTimeDollars(row.minutes);
                    return (
                      <tr key={row.label} className="border-b border-[var(--border)]/50">
                        <td className="py-3 px-4 font-medium">{row.label}</td>
                        <td className="py-3 px-4 text-right font-mono">
                          {row.minutes} min
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[var(--accent)]">
                          ${Math.round(savings.monthly).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[var(--accent)]">
                          ${Math.round(savings.annual).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-3">
              Based on $100K/yr salary, 22 working days per month. Multiply
              proportionally for higher compensation or multiple team members
              doing agent management.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--accent)] bg-[var(--accent)]/10 p-5 my-6">
            <p className="text-sm font-medium text-[var(--foreground)] mb-2">
              The compounding effect
            </p>
            <p className="text-sm">
              Time savings grow with every agent you add. Each new agent creates
              more threads, more status checks, more context to manage. Without
              structured thread management, the human overhead scales linearly
              with agent count. With Threadzy, it stays nearly flat because
              tagging, summaries, and the unified dashboard absorb the
              complexity.
            </p>
          </div>
        </div>
      </section>

      {/* Section 6: Token Savings Model */}
      <section id="token-savings" className="mb-16">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center text-sm font-bold shrink-0">
            6
          </span>
          Token Savings Model
        </h2>

        <div className="space-y-4 text-[var(--muted-foreground)] leading-relaxed">
          <p>
            Token savings depend on your starting point. We model two baselines
            to give you an honest picture.
          </p>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5 my-6">
            <p className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-3 font-mono">
              Assumptions (deliberately conservative)
            </p>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <p className="font-medium text-[var(--foreground)]">Thread parameters</p>
                <p>30 messages per thread (not 50)</p>
                <p>2 agent interactions per thread per day (not 10)</p>
                <p>Standard tier pricing: $9/MTok</p>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Three baselines compared</p>
                <p>Raw replay: 30 msgs x 500 tok = 15,000 tokens</p>
                <p>Platform summary: ~10,000 tokens (typical)</p>
                <p>Threadzy: 500 tok summary + 500 tok tool overhead = 1,000 tokens</p>
              </div>
            </div>
          </div>

          <p className="text-sm">
            The ~500 token tool overhead accounts for the Threadzy API call
            itself: the tool specification in the agent&apos;s context, request
            formatting, and response parsing. This is a real cost that belongs
            on the &ldquo;with Threadzy&rdquo; side.
          </p>

          {/* Standard tier with honest numbers */}
          <h3 className="text-lg font-bold mt-8 mb-4">
            Standard Tier ($9/MTok), 2 interactions/day
          </h3>
          <TokenComparisonChart
            data={standardScenarios.map((s) => ({
              label: s.label,
              without: s.withoutPlatform,
              with: s.withThreadzy,
            }))}
          />
          <div className="mt-4">
            <SavingsSummaryTable
              scenarios={standardScenarios.map((s) => ({
                label: s.label,
                monthlySavings: s.monthlySavingsVsPlatform,
                annualSavings: s.annualSavingsVsPlatform,
                percentReduction: s.percentVsPlatform,
              }))}
            />
          </div>

          <p className="text-xs text-[var(--muted-foreground)] mt-2">
            These numbers compare Threadzy against platform-level
            summarization (~10K tokens), not raw replay. If your agents have no
            summarization at all, the savings are roughly 15x larger. Use the
            calculator in Section 9 to model your exact setup.
          </p>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5 my-6">
            <p className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-3 font-mono">
              Model pricing reference (June 2026, blended input/output)
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="text-center">
                <p className="text-lg font-bold font-mono">$3<span className="text-sm text-[var(--muted-foreground)]">/MTok</span></p>
                <p className="text-xs text-[var(--muted-foreground)]">Budget: Haiku 4.5 / GPT-5.4 mini</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold font-mono">$9<span className="text-sm text-[var(--muted-foreground)]">/MTok</span></p>
                <p className="text-xs text-[var(--muted-foreground)]">Standard: Sonnet 4.6 / GPT-5.4</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold font-mono">$15-18<span className="text-sm text-[var(--muted-foreground)]">/MTok</span></p>
                <p className="text-xs text-[var(--muted-foreground)]">Premium: Opus 4.8 / GPT-5.5</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 7: Information Fidelity */}
      <section id="fidelity" className="mb-16">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center text-sm font-bold shrink-0">
            7
          </span>
          Information Fidelity
        </h2>

        <div className="space-y-4 text-[var(--muted-foreground)] leading-relaxed">
          <p className="text-lg text-[var(--foreground)] font-medium">
            A 500-token summary replacing 15,000 tokens of history is a 97%
            compression ratio. What gets lost?
          </p>

          <p>
            This is the right question to ask. Any summary is lossy. AI-generated
            summaries can miss nuance, flatten context, or drop details that
            turn out to be important later. Anyone who has used AI summarization
            knows this.
          </p>

          <p>
            Threadzy addresses this in three ways.
          </p>

          <div className="space-y-4 my-6">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5">
              <p className="text-sm font-bold text-[var(--foreground)] mb-2">
                1. Structured metadata supplements the summary
              </p>
              <p className="text-sm">
                Threadzy does not rely on the summary alone. Every thread
                carries structured metadata: status, tags, key decisions, action
                items, and participant history. An agent querying Threadzy gets
                the summary plus this metadata. The structured fields capture
                facts that summaries might gloss over.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5">
              <p className="text-sm font-bold text-[var(--foreground)] mb-2">
                2. Full message history is always available
              </p>
              <p className="text-sm">
                Summaries are the default retrieval path, not the only one.
                When an agent needs the complete picture (a legal review, a
                complex debugging session, a sensitive HR matter), it can
                request the full message history. The summary serves as a
                fast-path for the 90% of lookups that do not need full fidelity.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5">
              <p className="text-sm font-bold text-[var(--foreground)] mb-2">
                3. Summaries are continuously updated
              </p>
              <p className="text-sm">
                Unlike a one-time summarization, Threadzy updates summaries as
                new messages arrive. Key decisions, status changes, and action
                items are tracked incrementally. The summary reflects the
                current state, not a stale snapshot.
              </p>
            </div>
          </div>

          <p>
            We do not claim summaries are lossless. They are a deliberate
            tradeoff: pay less for the fast path, and keep the full path
            available when you need it.
          </p>
        </div>
      </section>

      {/* Section 8: ROI Summary */}
      <section id="roi" className="mb-16">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center text-sm font-bold shrink-0">
            8
          </span>
          ROI Summary
        </h2>

        <div className="space-y-4 text-[var(--muted-foreground)] leading-relaxed">
          <p>
            Real ROI requires knowing what Threadzy costs. Plans start at
            $25/agent/month, with volume discounts for larger teams.
          </p>

          <p>
            The savings below show both gross value and net ROI after
            Threadzy plan cost. All figures use standard tier ($9/MTok),
            $100K/year salary, and $25/agent/month.
          </p>

          <div className="grid gap-4 sm:grid-cols-3 my-6">
            {[
              {
                label: "Solo operator",
                desc: "1 agent, 10 threads/day",
                agents: 1,
                timeSavings: humanTimeDollars(15),
                tokenSavings: standardScenarios[0].annualSavingsVsPlatform,
                planCost: 1 * 25 * 12,
              },
              {
                label: "Small team",
                desc: "3-5 agents, 30 threads/day",
                agents: 5,
                timeSavings: humanTimeDollars(30),
                tokenSavings: standardScenarios[1].annualSavingsVsPlatform,
                planCost: 5 * 25 * 12,
              },
              {
                label: "Scaling team",
                desc: "10-15 agents, 100 threads/day",
                agents: 15,
                timeSavings: humanTimeDollars(45),
                tokenSavings: standardScenarios[2].annualSavingsVsPlatform,
                planCost: 15 * 25 * 12,
              },
            ].map((s) => {
              const totalAnnual = s.timeSavings.annual + s.tokenSavings - s.planCost;
              return (
                <div key={s.label} className="rounded-xl border border-[var(--accent)] bg-[var(--accent)]/10 p-6 text-center">
                  <p className="text-xs uppercase tracking-widest text-[var(--accent)] mb-1 font-mono">
                    {s.label}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)] mb-3">
                    {s.desc}
                  </p>
                  <p className="text-2xl font-bold font-mono text-[var(--foreground)]">
                    {totalAnnual >= 1000
                      ? `$${(totalAnnual / 1000).toFixed(1)}K`
                      : `$${Math.round(totalAnnual)}`}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    net annual ROI
                  </p>
                  <div className="mt-3 pt-3 border-t border-[var(--accent)]/30 text-xs">
                    <p className="text-[var(--accent)]">
                      ${Math.round(s.timeSavings.annual).toLocaleString()} human time
                    </p>
                    <p className="text-[var(--muted-foreground)]">
                      + ${Math.round(s.tokenSavings).toLocaleString()} token savings
                    </p>
                    <p className="text-[var(--muted-foreground)]">
                      − ${Math.round(s.planCost).toLocaleString()} Threadzy plan
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5">
            <p className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-3 font-mono">
              Key points
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)] font-bold shrink-0">60%+</span>
                <span>of the value comes from human time savings, not token reduction</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)] font-bold shrink-0">90%</span>
                <span>reconstruction reduction vs. platform summarization (~10K to ~1K tokens)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)] font-bold shrink-0">Linear</span>
                <span>scaling. Value grows with every agent and thread you add.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)] font-bold shrink-0">$25</span>
                <span>/agent/month. Free during early access, then plan-based pricing.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Section 9: Interactive Calculator */}
      <section id="calculator" className="mb-16">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center text-sm font-bold shrink-0">
            9
          </span>
          Calculate Your Savings
        </h2>
        <p className="text-[var(--muted-foreground)] mb-6">
          Adjust the inputs to model your own setup. The calculator includes
          tool call overhead on the Threadzy side, compares against platform
          summarization, and shows net ROI after the $25/agent/month plan cost.
        </p>
        <SavingsCalculator />
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-[var(--accent)] bg-[var(--accent)]/10 p-8 text-center">
        <h2 className="text-2xl font-bold mb-3">
          Stop hunting for thread status
        </h2>
        <p className="text-[var(--muted-foreground)] mb-6 max-w-xl mx-auto">
          Threadzy gives your humans one dashboard and your agents structured
          memory. Connect your first agent in under 5 minutes.
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
