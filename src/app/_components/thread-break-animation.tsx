"use client";

import { useEffect, useRef, useState } from "react";

const CHAOTIC_MESSAGES = [
  { author: "agent", text: "Deployed v2.3.1 to staging" },
  { author: "user", text: "Can you check the login bug?" },
  { author: "agent", text: "Database migration complete" },
  { author: "user", text: "What about the pricing page?" },
  { author: "agent", text: "Fixed CSS on mobile nav" },
  { author: "user", text: "Did you see the client email?" },
  { author: "agent", text: "API rate limits configured" },
  { author: "user", text: "Need summary of last week" },
  { author: "agent", text: "Tests passing, 94% coverage" },
  { author: "user", text: "Update the onboarding flow" },
  { author: "agent", text: "Webhook retry logic added" },
  { author: "user", text: "Which thread was that in?" },
];

interface OrganizedThread {
  title: string;
  color: string;
  messages: { author: string; text: string }[];
}

const ORGANIZED_THREADS: OrganizedThread[] = [
  {
    title: "Deployment",
    color: "#14B8A6",
    messages: [
      { author: "agent", text: "Deployed v2.3.1 to staging" },
      { author: "agent", text: "Tests passing, 94% coverage" },
      { author: "agent", text: "Database migration complete" },
    ],
  },
  {
    title: "Bug Fixes",
    color: "#0E7490",
    messages: [
      { author: "user", text: "Can you check the login bug?" },
      { author: "agent", text: "Fixed CSS on mobile nav" },
      { author: "agent", text: "API rate limits configured" },
    ],
  },
  {
    title: "Product",
    color: "#0D9488",
    messages: [
      { author: "user", text: "What about the pricing page?" },
      { author: "user", text: "Update the onboarding flow" },
      { author: "user", text: "Need summary of last week" },
    ],
  },
  {
    title: "Comms",
    color: "#115E59",
    messages: [
      { author: "user", text: "Did you see the client email?" },
      { author: "user", text: "Which thread was that in?" },
      { author: "agent", text: "Webhook retry logic added" },
    ],
  },
];

export function ThreadBreakAnimation() {
  const [phase, setPhase] = useState<"chaos" | "breaking" | "organized">("chaos");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function cycle() {
      setPhase("chaos");
      timerRef.current = setTimeout(() => {
        setPhase("breaking");
        timerRef.current = setTimeout(() => {
          setPhase("organized");
          timerRef.current = setTimeout(cycle, 4000);
        }, 1200);
      }, 3000);
    }
    cycle();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Phase labels */}
      <div className="flex justify-center mb-6">
        <div className="flex items-center gap-3 text-sm">
          <span
            className={`px-3 py-1 rounded-full transition-all duration-500 ${
              phase === "chaos"
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "text-[var(--muted-foreground)] opacity-50"
            }`}
          >
            One giant thread
          </span>
          <svg className="w-4 h-4 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span
            className={`px-3 py-1 rounded-full transition-all duration-500 ${
              phase === "organized"
                ? "bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30"
                : "text-[var(--muted-foreground)] opacity-50"
            }`}
          >
            Organized threads
          </span>
        </div>
      </div>

      <div className="relative min-h-[320px]">
        {/* Chaos phase: one tall messy column */}
        <div
          className={`absolute inset-0 flex justify-center transition-all duration-700 ${
            phase === "chaos"
              ? "opacity-100 scale-100"
              : "opacity-0 scale-95 pointer-events-none"
          }`}
        >
          <div className="w-full max-w-md rounded-xl border border-red-500/30 bg-red-500/5 p-3 overflow-hidden">
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-medium text-red-400">
                Everything Thread (147 messages)
              </span>
            </div>
            <div className="space-y-1.5">
              {CHAOTIC_MESSAGES.map((msg, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-[var(--background)]/60 border border-[var(--border)]/50"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                      msg.author === "agent"
                        ? "bg-[var(--primary)]/80 text-[var(--primary-foreground)]"
                        : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                    }`}
                  >
                    {msg.author}
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)] leading-tight">
                    {msg.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Breaking phase: brief flash */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            phase === "breaking"
              ? "opacity-100 scale-100"
              : "opacity-0 scale-110 pointer-events-none"
          }`}
        >
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent)]/20 border border-[var(--accent)]/30">
              <svg className="w-5 h-5 text-[var(--accent)] animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm font-medium text-[var(--accent)]">
                Threadzy organizing...
              </span>
            </div>
          </div>
        </div>

        {/* Organized phase: 4 clean columns */}
        <div
          className={`absolute inset-0 transition-all duration-700 ${
            phase === "organized"
              ? "opacity-100 scale-100"
              : "opacity-0 scale-95 pointer-events-none"
          }`}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ORGANIZED_THREADS.map((thread, i) => (
              <div
                key={thread.title}
                className="rounded-xl border bg-[var(--background)]/60 p-3 transition-all duration-500"
                style={{
                  borderColor: `${thread.color}40`,
                  animationDelay: `${i * 150}ms`,
                  opacity: phase === "organized" ? 1 : 0,
                  transform: phase === "organized" ? "translateY(0)" : "translateY(20px)",
                  transition: `opacity 0.5s ease ${i * 0.15}s, transform 0.5s ease ${i * 0.15}s`,
                }}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: thread.color }}
                  />
                  <span
                    className="text-xs font-medium"
                    style={{ color: thread.color }}
                  >
                    {thread.title}
                  </span>
                </div>
                <div className="space-y-1">
                  {thread.messages.map((msg, j) => (
                    <div
                      key={j}
                      className="px-2 py-1 rounded text-[10px] text-[var(--muted-foreground)] bg-[var(--muted)]/30 border border-[var(--border)]/30 leading-tight"
                    >
                      {msg.text}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${thread.color}20`, color: thread.color }}>
                    {thread.messages.length} msgs
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
                    summarized
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
