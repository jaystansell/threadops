"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RedispatchButton({ threadId }: { threadId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"idle" | "success" | "error">("idle");
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    setResult("idle");
    try {
      const res = await fetch(`/api/threads/${threadId}/redispatch`, {
        method: "POST",
      });
      if (res.ok) {
        setResult("success");
        router.refresh();
      } else {
        setResult("error");
      }
    } catch {
      setResult("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="text-xs px-2 py-0.5 rounded bg-amber-600/30 text-amber-300 hover:bg-amber-600/50 transition-colors border border-amber-700/50 disabled:opacity-50"
    >
      {loading ? "Retrying\u2026" : result === "success" ? "Dispatched!" : result === "error" ? "Failed \u2014 retry?" : "Retry delivery"}
    </button>
  );
}
