"use client";

export function DashboardMockup() {
  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--background)] shadow-2xl">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--muted)] border-b border-[var(--border)]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
        </div>
        <div className="flex-1 ml-3">
          <div className="bg-[var(--background)] rounded-md px-3 py-1 text-[10px] text-[var(--muted-foreground)] font-mono">
            threadzy.ai/threads
          </div>
        </div>
      </div>

      {/* App layout */}
      <div className="flex h-[320px] sm:h-[360px]">
        {/* Sidebar */}
        <div className="w-[180px] sm:w-[220px] border-r border-[var(--border)] bg-[var(--background)] p-3 overflow-hidden shrink-0">
          <div className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] font-mono mb-3">
            Threads
          </div>

          {/* Thread items */}
          <div className="space-y-2">
            <div className="rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30 p-2.5 cursor-default">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-[var(--accent)]">Tax Filing Q4</span>
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" title="Awaiting response" />
              </div>
              <p className="text-[9px] text-[var(--muted-foreground)] leading-tight">Need your approval on the amended 1040...</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">CFO Agent</span>
                <span className="text-[8px] text-[var(--muted-foreground)]">2m ago</span>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--border)] p-2.5 cursor-default">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold">Property Lease Review</span>
              </div>
              <p className="text-[9px] text-[var(--muted-foreground)] leading-tight">Completed analysis of the new tenant...</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">Ops Agent</span>
                <span className="text-[8px] text-[var(--muted-foreground)]">1h ago</span>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--border)] p-2.5 cursor-default">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold">Customer Onboarding</span>
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" title="Awaiting response" />
              </div>
              <p className="text-[9px] text-[var(--muted-foreground)] leading-tight">Waiting on your decision re: pricing...</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">Sales Agent</span>
                <span className="text-[8px] text-[var(--muted-foreground)]">3h ago</span>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--border)] p-2.5 cursor-default opacity-60">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold">Research: AI Trends</span>
              </div>
              <p className="text-[9px] text-[var(--muted-foreground)] leading-tight">Summary of findings from last week...</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">Research Agent</span>
                <span className="text-[8px] text-[var(--muted-foreground)]">2d ago</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Thread header */}
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold">Tax Filing Q4</h4>
              <p className="text-[9px] text-[var(--muted-foreground)]">CFO Agent &middot; 5 messages &middot; Open</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] px-2 py-0.5 rounded-full bg-blue-400/20 text-blue-400 font-medium">Awaiting your reply</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 space-y-3 overflow-hidden">
            <div className="flex gap-2">
              <div className="w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0">
                <span className="text-[8px] text-[var(--accent-foreground)] font-bold">C</span>
              </div>
              <div className="rounded-lg bg-[var(--muted)] px-3 py-2 max-w-[80%]">
                <p className="text-[10px] text-[var(--foreground)] leading-relaxed">
                  I reviewed the Q4 expenses and found 3 deductions we missed. The amended 1040 would save approximately $2,400. Should I proceed with filing?
                </p>
                <span className="text-[8px] text-[var(--muted-foreground)] mt-1 block">CFO Agent &middot; 2:34 PM</span>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <div className="rounded-lg bg-[var(--accent)]/20 px-3 py-2 max-w-[80%]">
                <p className="text-[10px] text-[var(--foreground)] leading-relaxed">
                  Yes, go ahead. What do you need from me?
                </p>
                <span className="text-[8px] text-[var(--muted-foreground)] mt-1 block">You &middot; 2:51 PM</span>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0">
                <span className="text-[8px] text-[var(--accent-foreground)] font-bold">C</span>
              </div>
              <div className="rounded-lg bg-[var(--muted)] px-3 py-2 max-w-[80%] border border-blue-400/30">
                <p className="text-[10px] text-[var(--foreground)] leading-relaxed">
                  I need your SSN confirmation and signature on the attached form. I have attached the draft. Can you confirm the home office square footage is still 180 sq ft?
                </p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)]">📎 Q4_amended_1040_draft.pdf</span>
                </div>
                <span className="text-[8px] text-[var(--muted-foreground)] mt-1 block">CFO Agent &middot; 2:52 PM</span>
              </div>
            </div>
          </div>

          {/* Composer */}
          <div className="px-4 py-3 border-t border-[var(--border)]">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 py-2">
              <span className="text-[10px] text-[var(--muted-foreground)]">Reply to CFO Agent...</span>
              <div className="ml-auto flex items-center gap-1.5">
                <svg className="w-3 h-3 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
