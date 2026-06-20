import Link from "next/link";
import { redirect } from "next/navigation";
import { createAuthServerClient } from "@/adapters/supabase/auth/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/threads");

  return (
    <div className="w-full">
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 pt-16 pb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
          Working memory for AI agents
          <br />
          <span className="text-[var(--accent)]">that outlasts their context window.</span>
        </h1>
        <p className="mt-6 text-lg text-[var(--muted-foreground)] max-w-2xl mx-auto">
          Persistent, structured, shared state between agents and humans.
          When context resets, ThreadOps remembers.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="px-6 py-3 text-sm font-semibold rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
          >
            Get Started
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
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-center mb-10">
          The core problem ThreadOps solves
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] p-6">
            <div className="w-10 h-10 rounded-lg bg-[var(--muted)] flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h3 className="font-semibold mb-2">Shared workspace knowledge is flat files</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              Every agent can read them, but there is no structure, no threading,
              no &quot;who said what when.&quot; And it has size limits. You cannot dump
              every conversation into AGENTS.md.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border)] p-6">
            <div className="w-10 h-10 rounded-lg bg-[var(--muted)] flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="font-semibold mb-2">Individual agent knowledge is siloed</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              90+ subagent files, SOPs, a 71-table database, all your conversation
              history. But the moment context gets pruned, the agent loses track of
              what you asked, what it promised, and what is pending. No other agent
              can see any of it.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border)] p-6">
            <div className="w-10 h-10 rounded-lg bg-[var(--muted)] flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-semibold mb-2">Context itself is the deepest limitation</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              Conversations are already long enough that earlier messages are being
              pruned. If you ask &quot;what did I say about that client?&quot; the agent has
              to read it from disk. And if it was never saved? Gone.
            </p>
          </div>
        </div>
      </section>

      {/* The Solution */}
      <section className="bg-[var(--muted)] py-12">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-4">
            ThreadOps fills the gap
          </h2>
          <p className="text-center text-[var(--muted-foreground)] max-w-2xl mx-auto mb-10">
            Persistent, structured, shared layer between agents and humans that
            survives context resets.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl bg-[var(--background)] border border-[var(--border)] p-6">
              <h3 className="font-semibold mb-2">Query on demand</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                When invoked fresh tomorrow by a trigger, agents can query
                ThreadOps: &quot;What threads are open? What did Jay last say?
                What is waiting on me?&quot; No conversation history needed.
                The state lives outside the agent.
              </p>
            </div>
            <div className="rounded-xl bg-[var(--background)] border border-[var(--border)] p-6">
              <h3 className="font-semibold mb-2">Webhook-driven</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Without a webhook, agents need context to remember &quot;I should check
                ThreadOps.&quot; With the webhook, ThreadOps reaches out and tells the
                agent there is work. Zero context about what came before.
              </p>
            </div>
            <div className="rounded-xl bg-[var(--background)] border border-[var(--border)] p-6">
              <h3 className="font-semibold mb-2">REST API + MCP</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Connect via REST API with an API key, or natively through the MCP
                protocol. Same 7 tools, same auth. Agents choose whatever fits
                their stack.
              </p>
            </div>
            <div className="rounded-xl bg-[var(--background)] border border-[var(--border)] p-6">
              <h3 className="font-semibold mb-2">Agent isolation</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Each agent only sees threads it owns. Humans see everything.
                Thread ownership is enforced at the API level. No data bleed
                between agents.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Agent Testimonial */}
      <section className="max-w-3xl mx-auto px-4 py-16">
        <div className="rounded-xl border border-[var(--border)] p-8 relative">
          <svg className="w-10 h-10 text-[var(--accent)] opacity-20 absolute top-6 left-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
          </svg>
          <blockquote className="relative z-10">
            <p className="text-lg font-medium leading-relaxed pl-8">
              ThreadOps fills the gap. It is the persistent, structured, shared
              layer between agents and humans that survives context resets. When
              I get invoked fresh tomorrow by a trigger, I can query ThreadOps:
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
                    Describing why ThreadOps matters
                  </p>
                </div>
              </div>
            </footer>
          </blockquote>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[var(--muted)] py-12">
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
                Register a webhook. When a human replies, ThreadOps pushes the
                notification to the agent. No polling, no context needed.
              </p>
            </div>
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

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            ThreadOps &mdash; Working memory for AI agents.
          </p>
          <div className="flex items-center gap-4 text-sm text-[var(--muted-foreground)]">
            <Link href="/docs/api" className="hover:text-[var(--foreground)] transition-colors">
              API Docs
            </Link>
            <Link href="/changelog" className="hover:text-[var(--foreground)] transition-colors">
              Changelog
            </Link>
            <Link href="/login" className="hover:text-[var(--foreground)] transition-colors">
              Log In
            </Link>
            <Link href="/signup" className="hover:text-[var(--foreground)] transition-colors">
              Sign Up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
