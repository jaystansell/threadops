"use client";

import { useEffect } from "react";

const TEAL = "#14b8a6";

/**
 * Stickman that runs across carrying a message envelope.
 * Renders for ~800ms then unmounts via onComplete callback.
 */
export function StickmanSendAnimation({ onComplete }: { onComplete?: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onComplete?.(), 900);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 120 40"
        className="stickman-send absolute bottom-1 left-0 h-8 w-auto"
        fill="none"
        stroke={TEAL}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* head */}
        <circle cx="18" cy="10" r="4" />
        {/* body */}
        <line x1="18" y1="14" x2="18" y2="26" />
        {/* legs in running pose */}
        <line x1="18" y1="26" x2="13" y2="35" className="stickman-leg-back" />
        <line x1="18" y1="26" x2="23" y2="35" className="stickman-leg-front" />
        {/* arms reaching forward holding envelope */}
        <line x1="18" y1="18" x2="28" y2="14" />
        <line x1="18" y1="18" x2="12" y2="22" className="stickman-arm-back" />
        {/* envelope */}
        <rect x="27" y="10" width="8" height="6" rx="0.5" fill={TEAL} fillOpacity="0.15" />
        <polyline points="27,10 31,13 35,10" />
      </svg>
    </div>
  );
}

/**
 * Stickman sweeping with a broom for archive action.
 * Renders for ~800ms then unmounts via onComplete callback.
 */
export function StickmanArchiveAnimation({ onComplete }: { onComplete?: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onComplete?.(), 900);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className="pointer-events-none overflow-hidden inline-flex items-center ml-2"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 50 44"
        className="stickman-sweep h-7 w-auto"
        fill="none"
        stroke={TEAL}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* head */}
        <circle cx="20" cy="8" r="4" />
        {/* body */}
        <line x1="20" y1="12" x2="20" y2="26" />
        {/* legs */}
        <line x1="20" y1="26" x2="15" y2="36" />
        <line x1="20" y1="26" x2="25" y2="36" />
        {/* arms holding broom */}
        <line x1="20" y1="17" x2="30" y2="22" />
        <line x1="20" y1="17" x2="14" y2="22" />
        {/* broom handle */}
        <line x1="30" y1="22" x2="38" y2="36" className="stickman-broom" />
        {/* broom bristles */}
        <line x1="36" y1="36" x2="40" y2="36" className="stickman-broom" />
        <line x1="35" y1="37" x2="41" y2="37" className="stickman-broom" />
        <line x1="36" y1="38" x2="40" y2="38" className="stickman-broom" />
        {/* dust particles */}
        <circle cx="43" cy="34" r="0.8" className="stickman-dust stickman-dust-1" fill={TEAL} fillOpacity="0.4" stroke="none" />
        <circle cx="45" cy="36" r="0.6" className="stickman-dust stickman-dust-2" fill={TEAL} fillOpacity="0.3" stroke="none" />
        <circle cx="44" cy="38" r="0.5" className="stickman-dust stickman-dust-3" fill={TEAL} fillOpacity="0.25" stroke="none" />
      </svg>
    </div>
  );
}

/**
 * Stickman idly looking around — used for empty states
 * (no threads selected, no messages, etc.)
 */
export function StickmanEmptyState() {
  return (
    <div className="flex flex-col items-center gap-3" aria-hidden="true">
      <svg
        viewBox="0 0 80 70"
        className="stickman-idle h-16 w-auto"
        fill="none"
        stroke={TEAL}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* head */}
        <circle cx="40" cy="14" r="6" />
        {/* eyes that look left/right */}
        <circle cx="37.5" cy="13" r="0.8" fill={TEAL} stroke="none" className="stickman-eye-l" />
        <circle cx="42.5" cy="13" r="0.8" fill={TEAL} stroke="none" className="stickman-eye-r" />
        {/* body */}
        <line x1="40" y1="20" x2="40" y2="40" />
        {/* legs standing */}
        <line x1="40" y1="40" x2="33" y2="55" />
        <line x1="40" y1="40" x2="47" y2="55" />
        {/* arms — one resting, one shading eyes */}
        <line x1="40" y1="26" x2="30" y2="34" className="stickman-arm-rest" />
        <line x1="40" y1="26" x2="50" y2="20" className="stickman-arm-shade" />
        <line x1="50" y1="20" x2="52" y2="18" className="stickman-arm-shade" />
        {/* question mark */}
        <text
          x="58"
          y="18"
          fontSize="10"
          fill={TEAL}
          fillOpacity="0.5"
          stroke="none"
          fontFamily="var(--font-heading)"
          className="stickman-question"
        >
          ?
        </text>
      </svg>
    </div>
  );
}
