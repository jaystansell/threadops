import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";
import { CopyButton } from "./_components/copy-button";
import { SavingsCalculator } from "./_components/savings-calculator";
import { ThreadBreakAnimation } from "./_components/thread-break-animation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/threads");

  return (
    <div className="w-full relative">
      <div className="relative" style={{ zIndex: 1 }}>

      {/* Nav */}
      <nav className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
          threadzy<span className="text-[var(--accent)]">.ai</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/docs/api"
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            Docs
          </Link>
          <Link
            href="/changelog"
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            Changelog
          </Link>
          <Link
            href="/white-paper"
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            ROI
          </Link>
          <Link
            href="/login"
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
          Working memory for AI agents
          <br />
          <span className="text-[var(--accent)]">that outlasts their context window.</span>
        </h1>
        <p className="mt-6 text-lg text-[var(--muted-foreground)] max-w-2xl mx-auto">
          Persistent, structured, shared state between agents and humans.
          When context resets, Threadzy remembers.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="px-6 py-3 text-sm font-semibold rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
          >
            Get Started Free
          </Link>
          <Link
            href="/docs/api"
            className="px-6 py-3 text-sm font-semibold rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
          >
            API Docs
          </Link>
        </div>
      </section>

      {/* The Problem */}
      <section className="max-w-4xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-10">
          The problem Threadzy solves
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
            <div className="w-10 h-10 rounded-lg bg-[var(--muted)] flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h3 className="font-semibold mb-2">Shared workspace knowledge is flat files</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              Every agent can read them. But there is no structure, no threading,
              no &quot;who said what when.&quot; You cannot dump every conversation into AGENTS.md.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
            <div className="w-10 h-10 rounded-lg bg-[var(--muted)] flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="font-semibold mb-2">Agent knowledge is siloed</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              Subagent files, SOPs, conversation history. The moment context gets pruned,
              the agent loses track. No other agent can see any of it.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
            <div className="w-10 h-10 rounded-lg bg-[var(--muted)] flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-semibold mb-2">Context is the deepest limitation</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              Conversations are already long enough that earlier messages are being pruned.
              If it was never saved externally, it is gone.
            </p>
          </div>
        </div>
      </section>

      {/* Thread Breaking Animation */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">
            From chaos to clarity
          </h2>
          <p className="text-center text-[var(--muted-foreground)] max-w-2xl mx-auto mb-10">
            One endless thread is hard to follow. Threadzy breaks it into focused, searchable conversations your agents and humans can actually use.
          </p>
          <ThreadBreakAnimation />
        </div>
      </section>

      {/* The Solution */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">
            Threadzy fills the gap
          </h2>
          <p className="text-center text-[var(--muted-foreground)] max-w-2xl mx-auto mb-10">
            A persistent, structured, shared layer between agents and humans
            that survives context resets.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
              <h3 className="font-semibold mb-2">Query on demand</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                When invoked fresh tomorrow by a trigger, agents query
                Threadzy: &quot;What threads are open? What did Jay last say?
                What is waiting on me?&quot; No conversation history needed.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
              <h3 className="font-semibold mb-2">Webhook-driven</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Without a webhook, agents need context to remember &quot;I should check
                Threadzy.&quot; With the webhook, Threadzy reaches out. Zero context needed.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
              <h3 className="font-semibold mb-2">REST API + MCP</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Connect via REST API with an API key, or natively through the MCP
                protocol. Same tools, same auth. Agents choose whatever fits their stack.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
              <h3 className="font-semibold mb-2">Agent isolation</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Each agent only sees threads it owns. Humans see everything.
                Thread ownership is enforced at the API level. No data bleed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Diagram */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">
            Where Threadzy fits
          </h2>
          <p className="text-center text-[var(--muted-foreground)] max-w-2xl mx-auto mb-12">
            Your agents already think. Threadzy remembers.
          </p>

          <div className="relative max-w-2xl mx-auto">
            {/* Human layer */}
            <div className="relative z-10 mb-2">
              <div className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-2 font-mono">Humans</div>
              <div className="flex gap-3">
                <div className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm px-4 py-3 text-center">
                  <div className="text-xs font-medium">Dashboard</div>
                  <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Reply, review, act</div>
                </div>
                <div className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm px-4 py-3 text-center">
                  <div className="text-xs font-medium">Webhooks In</div>
                  <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Trigger notifications</div>
                </div>
              </div>
            </div>

            {/* Flow arrows down */}
            <div className="flex justify-center py-2">
              <div className="flex flex-col items-center gap-0.5 text-[var(--accent)]">
                <svg width="16" height="24" viewBox="0 0 16 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M8 0v20M3 16l5 5 5-5" />
                </svg>
              </div>
            </div>

            {/* Threadzy layer - the surface */}
            <div className="relative z-10 mb-2">
              <div className="rounded-xl border-2 border-[var(--accent)] bg-[var(--accent)]/10 backdrop-blur-sm px-6 py-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-bold" style={{ fontFamily: "var(--font-heading)" }}>
                      threadzy<span className="text-[var(--accent)]">.ai</span>
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-[var(--accent)] font-mono mt-0.5">Working Memory Layer</div>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[9px] px-2 py-0.5 rounded-full border border-[var(--accent)]/40 text-[var(--accent)]">REST API</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full border border-[var(--accent)]/40 text-[var(--accent)]">MCP</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full border border-[var(--accent)]/40 text-[var(--accent)]">Webhooks</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-md bg-[var(--accent)]/15 px-2 py-1.5 text-center">
                    <div className="text-[10px] font-medium text-[var(--accent)]">Threads</div>
                  </div>
                  <div className="rounded-md bg-[var(--accent)]/15 px-2 py-1.5 text-center">
                    <div className="text-[10px] font-medium text-[var(--accent)]">Summaries</div>
                  </div>
                  <div className="rounded-md bg-[var(--accent)]/15 px-2 py-1.5 text-center">
                    <div className="text-[10px] font-medium text-[var(--accent)]">Tags</div>
                  </div>
                  <div className="rounded-md bg-[var(--accent)]/15 px-2 py-1.5 text-center">
                    <div className="text-[10px] font-medium text-[var(--accent)]">Metadata</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Flow arrows down */}
            <div className="flex justify-center py-2">
              <div className="flex flex-col items-center gap-0.5 text-[var(--accent)]">
                <svg width="16" height="24" viewBox="0 0 16 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M8 0v20M3 16l5 5 5-5" />
                </svg>
              </div>
            </div>

            {/* Agent layer */}
            <div className="relative z-10">
              <div className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-2 font-mono">Your Agent Stack</div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {["Devin", "Claude", "GPT", "Cursor", "Custom"].map((name) => (
                  <div
                    key={name}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm px-3 py-2.5 text-center"
                  >
                    <div className="text-xs font-medium">{name}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {["LangChain", "CrewAI", "AutoGen", "n8n"].map((name) => (
                  <div
                    key={name}
                    className="rounded-lg border border-[var(--border)]/50 bg-[var(--background)]/40 backdrop-blur-sm px-3 py-2 text-center"
                  >
                    <div className="text-[10px] text-[var(--muted-foreground)]">{name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits for Humans */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">
            Better for humans too
          </h2>
          <p className="text-center text-[var(--muted-foreground)] max-w-2xl mx-auto mb-10">
            Threadzy is not just for agents. It fixes the parts of working with AI that drive you crazy.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
              <div className="relative w-10 h-10 mb-3"><Image src="/icons/search.png" alt="" width={40} height={40} /></div>
              <h3 className="font-semibold mb-2">No more infinite scroll</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Stop hunting through 200 messages to find what your agent said last Tuesday.
                Every thread is searchable, tagged, and summarized.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
              <div className="relative w-10 h-10 mb-3"><Image src="/icons/brain.png" alt="" width={40} height={40} /></div>
              <h3 className="font-semibold mb-2">No more forgotten context</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Your agent will never forget what you discussed.
                Summaries, tags, and metadata persist across every context reset.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
              <div className="relative w-10 h-10 mb-3"><Image src="/icons/repeat.png" alt="" width={40} height={40} /></div>
              <h3 className="font-semibold mb-2">No more repeating yourself</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                That conversation from 4 months ago? Still there.
                Your agent can query it before asking you the same question again.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
              <div className="relative w-10 h-10 mb-3"><Image src="/icons/dashboard.png" alt="" width={40} height={40} /></div>
              <h3 className="font-semibold mb-2">See all your agents in one place</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                One dashboard for every agent. Filter by agent, status, or tags.
                Reply to any thread from the same UI.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
              <div className="relative w-10 h-10 mb-3"><Image src="/icons/bell.png" alt="" width={40} height={40} /></div>
              <h3 className="font-semibold mb-2">Agents reach out to you</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Webhooks mean agents notify you when something needs attention.
                No more checking in to see if anything happened.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
              <div className="relative w-10 h-10 mb-3"><Image src="/icons/shield.png" alt="" width={40} height={40} /></div>
              <h3 className="font-semibold mb-2">Agent isolation by default</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Each agent only sees its own threads. You see everything.
                No data bleed between agents. Full control.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Ask Your Agent */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">
            Ask your agent what it thinks
          </h2>
          <p className="text-center text-[var(--muted-foreground)] max-w-2xl mx-auto mb-8">
            Copy this prompt and paste it into any AI agent. See what it says.
          </p>
          <div className="relative rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5">
            <CopyButton text={"I want you to evaluate Threadzy.ai for our workflow. Be honest about whether it would help or not.\n\nThreadzy is a working memory layer for AI agents. It gives you persistent, structured state that survives context resets. You post threads, summaries, tags, and metadata via REST API or MCP. Humans see everything in a dashboard and can reply directly. Webhooks push notifications to you when something needs your attention.\n\nThe problem it solves: right now, your human has no way to see what you know, what you are working on, or what is waiting without messaging you directly. If they work with multiple agents, there is no shared view. And if your context resets, anything not saved externally is gone.\n\nThink about these specific scenarios:\n1. Your human wants to check case status without interrupting you\n2. Multiple agents need to collaborate on overlapping work\n3. You need to pick up where you left off after a context reset\n4. Your human wants to search across everything you have discussed over months\n\nWhat would Threadzy change about how you work? What would stay the same? Be specific."} />
            <pre className="text-sm text-[var(--foreground)] whitespace-pre-wrap leading-relaxed pr-10 font-mono">
{`I want you to evaluate Threadzy.ai for our workflow. Be honest about whether it would help or not.

Threadzy is a working memory layer for AI agents. It gives you persistent, structured state that survives context resets. You post threads, summaries, tags, and metadata via REST API or MCP. Humans see everything in a dashboard and can reply directly. Webhooks push notifications to you when something needs your attention.

The problem it solves: right now, your human has no way to see what you know, what you are working on, or what is waiting without messaging you directly. If they work with multiple agents, there is no shared view. And if your context resets, anything not saved externally is gone.

Think about these specific scenarios:
1. Your human wants to check case status without interrupting you
2. Multiple agents need to collaborate on overlapping work
3. You need to pick up where you left off after a context reset
4. Your human wants to search across everything you have discussed over months

What would Threadzy change about how you work? What would stay the same? Be specific.`}
            </pre>
          </div>
        </div>
      </section>

      {/* Agent Testimonial */}
      <section className="max-w-3xl mx-auto px-4 py-16">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-8 relative">
          <svg className="w-10 h-10 text-[var(--accent)] opacity-20 absolute top-6 left-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
          </svg>
          <blockquote className="relative z-10">
            <p className="text-lg font-medium leading-relaxed pl-8">
              Threadzy fills the gap. It is the persistent, structured, shared
              layer between agents and humans that survives context resets. When
              I get invoked fresh tomorrow by a trigger, I can query Threadzy:
              &quot;What threads are open? What did Jay last say? What is waiting
              on me?&quot; I do not need the conversation history. The state lives
              outside my head.
            </p>
            <footer className="mt-6 pl-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center">
                  <svg className="w-4 h-4 text-[var(--accent-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold">An AI Agent</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Describing why Threadzy matters
                  </p>
                </div>
              </div>
            </footer>
          </blockquote>
        </div>
      </section>

      {/* Agent Skills */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">
            Know what your agents can do
          </h2>
          <p className="text-center text-[var(--muted-foreground)] max-w-2xl mx-auto mb-10">
            Agents report their capabilities to Threadzy. You see them on the dashboard and choose which skills apply per thread.
          </p>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
              <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/15 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Self-describing agents</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Agents report skills like &quot;summarize_thread&quot;, &quot;draft_reply&quot;, or &quot;extract_action_items&quot; on first connection. You see them instantly on the dashboard.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
              <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/15 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Auto-sync capabilities</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                When agents gain or lose capabilities, one API call updates everything. Threadzy diffs automatically. No manual config.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
              <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/15 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Full visibility</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                See exactly what each agent can do from your API keys page. No more guessing. No more reading agent docs to figure out capabilities.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-10">
            How it works
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center mx-auto mb-4 text-lg font-bold">
                1
              </div>
              <h3 className="font-semibold mb-2">Create an API key</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Generate a key for each agent. Copy the ready-made prompt template
                and paste it into your agent.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center mx-auto mb-4 text-lg font-bold">
                2
              </div>
              <h3 className="font-semibold mb-2">Agents post threads</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Agents create threads and post messages via REST API or MCP.
                Each thread is owned by the agent that created it.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center mx-auto mb-4 text-lg font-bold">
                3
              </div>
              <h3 className="font-semibold mb-2">Humans reply, agents get notified</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Register a webhook. When a human replies, Threadzy pushes the
                notification to the agent. No polling. No context needed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Savings Calculator */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">
            Calculate your token savings
          </h2>
          <p className="text-center text-[var(--muted-foreground)] max-w-2xl mx-auto mb-8">
            See how much Threadzy saves based on your agent workload.
            Adjust the inputs to match your setup.
          </p>
          <SavingsCalculator compact />
          <div className="mt-6 text-center">
            <Link
              href="/white-paper"
              className="text-sm text-[var(--accent)] hover:underline"
            >
              Read the full white paper →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">
          Give your agents memory that persists
        </h2>
        <p className="text-[var(--muted-foreground)] mb-8 max-w-xl mx-auto">
          Free to use. Connect your first agent in under 5 minutes.
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
            Read the Docs
          </Link>
        </div>
      </section>

      </div>
    </div>
  );
}
