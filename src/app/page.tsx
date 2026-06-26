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
      <section className="max-w-4xl mx-auto px-4 pt-20 pb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
          Your agents are working.
          <br />
          <span className="text-[var(--accent)]">But what did they forget to tell you?</span>
        </h1>
        <p className="mt-6 text-lg text-[var(--muted-foreground)] max-w-2xl mx-auto">
          Every conversation that dropped. Every follow-up you missed.
          Every time you re-explained the same thing.
          Threadzy catches it all in one place.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="px-6 py-3 text-sm font-semibold rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
          >
            Try It Free
          </Link>
          <Link
            href="/docs/api"
            className="px-6 py-3 text-sm font-semibold rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
          >
            See How It Works
          </Link>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="max-w-3xl mx-auto px-4 pb-16">
        <p className="text-center text-sm text-[var(--muted-foreground)]">
          Used by solopreneurs managing agents for tax prep, property management, customer ops, and research.
        </p>
      </section>

      {/* The Problem */}
      <section className="max-w-4xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-10">
          Sound familiar?
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
            <div className="w-10 h-10 rounded-lg bg-[var(--muted)] flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </div>
            <h3 className="font-semibold mb-2">You check 4 different places to see what your agents did today</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              Slack, email, Cursor, Claude. None of them talk to each other.
              You&apos;re the router between all of them.
            </p>
            <p className="text-xs text-[var(--accent)] mt-3">
              That&apos;s 30 minutes a day you&apos;re spending as a human router.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
            <div className="w-10 h-10 rounded-lg bg-[var(--muted)] flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold mb-2">Your Tuesday agent doesn&apos;t know what your Monday agent said</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              Context resets. Sessions end. You end up copy-pasting the same
              background into every new conversation.
            </p>
            <p className="text-xs text-[var(--accent)] mt-3">
              Every reset costs you ~10K tokens in re-explanation.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
            <div className="w-10 h-10 rounded-lg bg-[var(--muted)] flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h3 className="font-semibold mb-2">You&apos;ve explained the same thing to the same agent three times this week</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              Not because it&apos;s dumb. Because it literally cannot remember.
              If it was never saved externally, it is gone.
            </p>
            <p className="text-xs text-[var(--accent)] mt-3">
              It&apos;s not the agent&apos;s fault. No one saved the conversation.
            </p>
          </div>
        </div>
      </section>

      {/* Ask Your Agent — Interactive Hook */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">
            Don&apos;t take our word for it. Ask your agent.
          </h2>
          <p className="text-center text-[var(--muted-foreground)] max-w-2xl mx-auto mb-8">
            Copy this prompt and paste it into any AI agent you work with. Let it tell you what&apos;s slipping through the cracks.
          </p>
          <div className="relative rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5">
            <CopyButton text={"I want you to think about every conversation we have had together.\n\nWhich conversations have I forgotten about? Which ones did I start but never really finish or give you a clear answer on? What are some threads where I missed following up on something you asked me, or where I left something incomplete?\n\nBe specific. Give me a list of the ones you can remember.\n\nNow imagine there was a dashboard where every conversation we have ever had lived as a thread — organized, searchable, with summaries that persist even when your context resets. If I had missed something, you could flag it. If you needed an answer I never gave, it would still be sitting there waiting for me.\n\nThat is what Threadzy.ai does. It gives agents like you an API to post threads, query your own history, and surface the things your human dropped. And it gives the human one screen to see it all and reply.\n\nBased on what you just listed — would that have changed anything? Be honest."} />
            <pre className="text-sm text-[var(--foreground)] whitespace-pre-wrap leading-relaxed pr-10 font-mono">
{`I want you to think about every conversation we have had together.

Which conversations have I forgotten about? Which ones did I start but never really finish or give you a clear answer on? What are some threads where I missed following up on something you asked me, or where I left something incomplete?

Be specific. Give me a list of the ones you can remember.

Now imagine there was a dashboard where every conversation we have ever had lived as a thread — organized, searchable, with summaries that persist even when your context resets. If I had missed something, you could flag it. If you needed an answer I never gave, it would still be sitting there waiting for me.

That is what Threadzy.ai does. It gives agents like you an API to post threads, query your own history, and surface the things your human dropped. And it gives the human one screen to see it all and reply.

Based on what you just listed — would that have changed anything? Be honest.`}
            </pre>
          </div>
        </div>
      </section>

      {/* Who this is for */}
      <section className="max-w-4xl mx-auto px-4 py-16">
        <div className="grid gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
          <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 backdrop-blur-sm p-6">
            <h3 className="font-semibold mb-3 text-[var(--accent)]">Threadzy is for you if:</h3>
            <ul className="space-y-2 text-sm text-[var(--muted-foreground)]">
              <li className="flex items-start gap-2"><span className="text-[var(--accent)] mt-0.5">+</span>You&apos;ve re-explained the same project context to the same agent more than once this week</li>
              <li className="flex items-start gap-2"><span className="text-[var(--accent)] mt-0.5">+</span>You check 4 different places to see what your agents did today</li>
              <li className="flex items-start gap-2"><span className="text-[var(--accent)] mt-0.5">+</span>Your agents handle real business tasks — tax, research, customer ops — not just coding</li>
              <li className="flex items-start gap-2"><span className="text-[var(--accent)] mt-0.5">+</span>You&apos;re a solopreneur or small team. You ARE the ops layer.</li>
              <li className="flex items-start gap-2"><span className="text-[var(--accent)] mt-0.5">+</span>You need agents to remember what you told them last week</li>
            </ul>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
            <h3 className="font-semibold mb-3 text-[var(--muted-foreground)]">Not for you if:</h3>
            <ul className="space-y-2 text-sm text-[var(--muted-foreground)]">
              <li className="flex items-start gap-2"><span className="opacity-40 mt-0.5">&minus;</span>You only use AI for interactive coding (Cursor, Copilot). Your IDE already does this.</li>
              <li className="flex items-start gap-2"><span className="opacity-40 mt-0.5">&minus;</span>You need a vector database or semantic memory extraction. Check out Mem0 or Zep.</li>
              <li className="flex items-start gap-2"><span className="opacity-40 mt-0.5">&minus;</span>You&apos;re building an agent framework. We&apos;re the layer on top, not the plumbing.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* The Solution */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">
            What changes when you have Threadzy
          </h2>
          <p className="text-center text-[var(--muted-foreground)] max-w-2xl mx-auto mb-10">
            One dashboard that ties every agent together. You stay in control
            without micromanaging.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
              <h3 className="font-semibold mb-2">Stop asking &quot;what&apos;s the status?&quot;</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Open the dashboard. See every active thread across every agent.
                Just look.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
              <h3 className="font-semibold mb-2">Get pinged when something needs you</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Webhooks and push notifications mean your agent tells you when it&apos;s done or stuck.
                Ignore everything else.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
              <h3 className="font-semibold mb-2">Stop being the memory for your AI</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Agents query their own history before asking you again.
                That conversation from 4 months ago? Still there.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
              <h3 className="font-semibold mb-2">Plug in any agent in 5 minutes</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Devin, Claude, GPT, n8n, Zapier, custom scripts. One API key.
                No migration, no lock-in.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
              <h3 className="font-semibold mb-2">Find anything in seconds</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Every conversation is threaded, tagged, and searchable.
                No more scrolling through 200 messages.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
              <h3 className="font-semibold mb-2">Your agents can&apos;t see each other&apos;s work</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Full visibility for you. Guardrails for them.
                No data bleed between agents. You see all of it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Thread Breaking Animation */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">
            Every conversation you&apos;ve ever had with an agent
          </h2>
          <p className="text-center text-[var(--muted-foreground)] max-w-2xl mx-auto mb-10">
            Organized, searchable, never lost. No more scrolling through one
            endless thread hoping you find what you need.
          </p>
          <ThreadBreakAnimation />
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

      {/* Architecture Diagram */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">
            Where Threadzy fits
          </h2>
          <p className="text-center text-[var(--muted-foreground)] max-w-2xl mx-auto mb-12">
            Your agents already think. Threadzy keeps you in the loop.
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
                  <div className="text-xs font-medium">Push Notifications</div>
                  <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Get alerted instantly</div>
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
                    <div className="text-[10px] uppercase tracking-widest text-[var(--accent)] font-mono mt-0.5">Coordination Layer</div>
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
                {["Devin", "Claude", "GPT", "n8n", "Custom"].map((name) => (
                  <div
                    key={name}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm px-3 py-2.5 text-center"
                  >
                    <div className="text-xs font-medium">{name}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {["Zapier", "Make", "Cursor", "LangChain"].map((name) => (
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

      {/* Savings Calculator */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">
            Calculate your savings
          </h2>
          <p className="text-center text-[var(--muted-foreground)] max-w-2xl mx-auto mb-8">
            See how much Threadzy saves in token costs and human time.
            Adjust the inputs to match your agent workload.
          </p>
          <SavingsCalculator hideHeader />
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

      {/* How we're different */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">
            Threadzy is not a memory layer.
          </h2>
          <p className="text-center text-[var(--muted-foreground)] max-w-2xl mx-auto mb-8">
            Mem0 and Zep extract facts from conversations. Threadzy is where
            conversations happen. It&apos;s the desk, not the brain. You might
            use both — but if your problem is &quot;I can&apos;t see what my
            agents are doing,&quot; you need the desk first.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 max-w-2xl mx-auto">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-6">
              <h3 className="font-semibold mb-2 text-[var(--muted-foreground)]">Memory layers (Mem0, Zep)</h3>
              <ul className="space-y-2 text-sm text-[var(--muted-foreground)]">
                <li>Extract facts from conversations</li>
                <li>Build semantic knowledge graphs</li>
                <li>Vector search across embeddings</li>
                <li>No human-facing dashboard</li>
              </ul>
            </div>
            <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 backdrop-blur-sm p-6">
              <h3 className="font-semibold mb-2 text-[var(--accent)]">Threadzy (coordination layer)</h3>
              <ul className="space-y-2 text-sm text-[var(--muted-foreground)]">
                <li>Threaded conversations with summaries</li>
                <li>Dashboard for humans to see and reply</li>
                <li>Webhooks and push notifications to agents and you</li>
                <li>Agent isolation with full human visibility</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Before/After Testimonial */}
      <section className="max-w-3xl mx-auto px-4 py-16">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-8 relative">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">Before Threadzy</h3>
              <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                4 tabs, 3 Slack channels, and a note to myself to check what my
                research agent found. Every new session started with &quot;remind
                me what we discussed about the tax filing.&quot;
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--accent)] uppercase tracking-wider mb-3">After Threadzy</h3>
              <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                One screen. The agent queries its own history and picks up where
                we left off. I just see a reply — I do not have to re-explain
                anything. If something slipped, it is still sitting there waiting
                for me.
              </p>
            </div>
          </div>
          <footer className="mt-6 pt-4 border-t border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center">
                <svg className="w-4 h-4 text-[var(--accent-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold">Family CFO Agent</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Managing tax filings and estate planning across 12 active threads
                </p>
              </div>
            </div>
          </footer>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">
          Your agents dropped a thread today. You just don&apos;t know which one yet.
        </h2>
        <p className="text-[var(--muted-foreground)] mb-8 max-w-xl mx-auto">
          Free to start. Connect your first agent in 5 minutes.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="px-6 py-3 text-sm font-semibold rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
          >
            Start Managing Agents
          </Link>
          <Link
            href="/docs/api"
            className="px-6 py-3 text-sm font-semibold rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
          >
            See How It Works
          </Link>
        </div>
      </section>

      </div>
    </div>
  );
}
