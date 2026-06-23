"use client";

import { useMemo } from "react";

const YOGA_POSES = [
  // Tree pose
  {
    name: "Tree Pose",
    svg: (
      <svg width="32" height="40" viewBox="0 0 32 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="16" cy="5" r="3.5" />
        <line x1="16" y1="8.5" x2="16" y2="24" />
        <line x1="16" y1="24" x2="12" y2="36" />
        <line x1="16" y1="24" x2="20" y2="30" />
        <line x1="20" y1="30" x2="20" y2="24" />
        <line x1="16" y1="14" x2="10" y2="10" />
        <line x1="16" y1="14" x2="22" y2="10" />
        <line x1="10" y1="10" x2="16" y2="6" className="stickman-yoga-arm" />
        <line x1="22" y1="10" x2="16" y2="6" className="stickman-yoga-arm" />
      </svg>
    ),
  },
  // Warrior pose
  {
    name: "Warrior",
    svg: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="20" cy="5" r="3.5" />
        <line x1="20" y1="8.5" x2="20" y2="22" />
        <line x1="20" y1="22" x2="10" y2="36" />
        <line x1="20" y1="22" x2="30" y2="28" />
        <line x1="20" y1="14" x2="6" y2="14" />
        <line x1="20" y1="14" x2="34" y2="14" />
      </svg>
    ),
  },
  // Downward dog
  {
    name: "Downward Dog",
    svg: (
      <svg width="44" height="36" viewBox="0 0 44 36" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="3.5" />
        <line x1="12" y1="12" x2="22" y2="4" />
        <line x1="22" y1="4" x2="34" y2="32" />
        <line x1="34" y1="32" x2="38" y2="32" />
        <line x1="22" y1="4" x2="10" y2="32" />
        <line x1="10" y1="32" x2="6" y2="32" />
        <line x1="14" y1="10" x2="16" y2="18" />
      </svg>
    ),
  },
  // Side stretch
  {
    name: "Side Stretch",
    svg: (
      <svg width="36" height="40" viewBox="0 0 36 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3.5" />
        <line x1="18" y1="8.5" x2="18" y2="24" />
        <line x1="18" y1="24" x2="14" y2="36" />
        <line x1="18" y1="24" x2="22" y2="36" />
        <line x1="18" y1="14" x2="8" y2="10" />
        <path d="M18 14 Q28 6 30 2" className="stickman-yoga-arm" />
      </svg>
    ),
  },
  // Seated twist
  {
    name: "Seated Twist",
    svg: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3.5" />
        <line x1="18" y1="8.5" x2="18" y2="22" />
        <line x1="18" y1="22" x2="10" y2="32" />
        <line x1="10" y1="32" x2="26" y2="32" />
        <line x1="18" y1="14" x2="8" y2="18" />
        <line x1="18" y1="14" x2="28" y2="10" />
      </svg>
    ),
  },
  // Standing forward fold
  {
    name: "Forward Fold",
    svg: (
      <svg width="32" height="40" viewBox="0 0 32 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="16" cy="28" r="3.5" />
        <line x1="16" y1="24.5" x2="16" y2="10" />
        <line x1="16" y1="10" x2="12" y2="36" />
        <line x1="16" y1="10" x2="20" y2="36" />
        <line x1="16" y1="18" x2="12" y2="32" />
        <line x1="16" y1="18" x2="20" y2="32" />
      </svg>
    ),
  },
  // Mountain pose with arms up
  {
    name: "Mountain Pose",
    svg: (
      <svg width="32" height="42" viewBox="0 0 32 42" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="16" cy="5" r="3.5" />
        <line x1="16" y1="8.5" x2="16" y2="26" />
        <line x1="16" y1="26" x2="12" y2="38" />
        <line x1="16" y1="26" x2="20" y2="38" />
        <line x1="16" y1="12" x2="10" y2="2" className="stickman-yoga-arm" />
        <line x1="16" y1="12" x2="22" y2="2" className="stickman-yoga-arm" />
      </svg>
    ),
  },
  // Dancer pose
  {
    name: "Dancer",
    svg: (
      <svg width="36" height="42" viewBox="0 0 36 42" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3.5" />
        <line x1="18" y1="8.5" x2="18" y2="24" />
        <line x1="18" y1="24" x2="18" y2="38" />
        <path d="M18 24 Q28 20 30 10" />
        <line x1="18" y1="14" x2="10" y2="4" className="stickman-yoga-arm" />
        <line x1="18" y1="14" x2="28" y2="18" className="stickman-yoga-arm" />
      </svg>
    ),
  },
];

interface AwaitingResponseIndicatorProps {
  agentName: string | null;
}

export function AwaitingResponseIndicator({
  agentName,
}: AwaitingResponseIndicatorProps) {
  const pose = useMemo(
    () => YOGA_POSES[Math.floor(Math.random() * YOGA_POSES.length)],
    [],
  );

  return (
    <div className="flex items-center gap-3 py-3 px-2">
      <div
        className="text-[var(--muted-foreground)]/40"
        style={{ animation: "stickman-yoga-breathe 3s ease-in-out infinite" }}
      >
        {pose.svg}
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-[var(--muted-foreground)]/60 font-medium">
          Awaiting response
          {agentName ? ` from ${agentName}` : ""}...
        </span>
        <span className="text-[10px] text-[var(--muted-foreground)]/30 italic">
          {pose.name}
        </span>
      </div>
      <div className="flex gap-1 ml-auto">
        <span
          className="w-1.5 h-1.5 rounded-full bg-[var(--muted-foreground)]/20"
          style={{ animation: "stickman-dot-pulse 1.4s ease-in-out infinite" }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-[var(--muted-foreground)]/20"
          style={{
            animation: "stickman-dot-pulse 1.4s ease-in-out 0.2s infinite",
          }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-[var(--muted-foreground)]/20"
          style={{
            animation: "stickman-dot-pulse 1.4s ease-in-out 0.4s infinite",
          }}
        />
      </div>
    </div>
  );
}
