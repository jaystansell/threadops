"use client";

import { useCallback, useState } from "react";
import type { AgentReadiness, ReadinessIndicator, ReadinessTone } from "./agent-readiness";

interface ConnectionTestProps {
  apiKeyId: string;
  initialReadiness: AgentReadiness;
}

interface TestStatus {
  stage: "starting" | "pending" | "delivered" | "acknowledged" | "replied" | "failed";
  explanation: string;
  deliveryStatus: string | null;
  deliveryError: string | null;
}

const toneClasses: Record<ReadinessTone, string> = {
  green: "bg-green-900/40 text-green-300 border-green-700/60",
  yellow: "bg-yellow-900/30 text-yellow-300 border-yellow-700/60",
  red: "bg-red-900/30 text-red-300 border-red-700/60",
  grey: "bg-zinc-800/60 text-zinc-300 border-zinc-600/60",
};

function Indicator({ title, indicator }: { title: string; indicator: ReadinessIndicator }) {
  return (
    <div className={`rounded border px-2.5 py-2 ${toneClasses[indicator.tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider font-semibold">{title}</span>
        <span className="text-[10px] font-medium">{indicator.label}</span>
      </div>
      <p className="mt-1 text-[11px] leading-snug opacity-90">{indicator.explanation}</p>
    </div>
  );
}

export function ConnectionTest({ apiKeyId, initialReadiness }: ConnectionTestProps) {
  const [readiness] = useState(initialReadiness);
  const [testStatus, setTestStatus] = useState<TestStatus | null>(null);
  const [running, setRunning] = useState(false);

  const poll = useCallback(async (testId: string) => {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const response = await fetch(`/api/agents/${apiKeyId}/connection-test?test_id=${encodeURIComponent(testId)}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Unable to read connection test status");
      const status = await response.json() as TestStatus;
      setTestStatus(status);
      if (status.stage === "replied" || status.stage === "failed") return;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    setTestStatus({
      stage: "failed",
      explanation: "The test timed out waiting for a delivery result. Check that the endpoint is reachable and returns a response.",
      deliveryStatus: null,
      deliveryError: null,
    });
  }, [apiKeyId]);

  async function runTest() {
    setRunning(true);
    setTestStatus({ stage: "starting", explanation: "Creating a real test thread and sending a user message.", deliveryStatus: null, deliveryError: null });
    try {
      const response = await fetch(`/api/agents/${apiKeyId}/connection-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json() as { test_id?: string; error?: string };
      if (!response.ok || !data.test_id) {
        setTestStatus({ stage: "failed", explanation: data.error ?? "Could not start the connection test.", deliveryStatus: null, deliveryError: null });
        return;
      }
      await poll(data.test_id);
    } catch (error) {
      setTestStatus({
        stage: "failed",
        explanation: error instanceof Error ? error.message : "Connection test failed.",
        deliveryStatus: null,
        deliveryError: null,
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <Indicator title="API / MCP access" indicator={readiness.api} />
        <Indicator title="Webhook delivery" indicator={readiness.delivery} />
        <Indicator title="Autonomous handler" indicator={readiness.handler} />
      </div>
      {readiness.endpointHealth.some((health) =>
        health.duplicate_url || health.catch_all_filter || health.stale_no_recent_delivery || health.repeated_failures
      ) && (
        <div className="text-[11px] text-yellow-400">
          Endpoint hygiene warnings: {readiness.endpointHealth.flatMap((health) => [
            health.duplicate_url ? "duplicate URL" : null,
            health.catch_all_filter ? "catch-all filter" : null,
            health.stale_no_recent_delivery ? "no recent success" : null,
            health.repeated_failures ? "repeated failures" : null,
          ]).filter((warning, index, all): warning is string => Boolean(warning) && all.indexOf(warning) === index).join(", ")}.
        </div>
      )}
      <button
        type="button"
        onClick={runTest}
        disabled={running}
        className="rounded border border-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary)]/10 disabled:opacity-50"
      >
        {running ? "Testing connection..." : "Run connection test"}
      </button>
      {testStatus && (
        <div className={`rounded border px-3 py-2 text-xs ${testStatus.stage === "replied" ? toneClasses.green : testStatus.stage === "failed" ? toneClasses.red : toneClasses.yellow}`}>
          <div className="font-semibold">Stage: {testStatus.stage}</div>
          <p className="mt-1">{testStatus.explanation}</p>
          {testStatus.deliveryError && <p className="mt-1 font-mono">Receiver response: {testStatus.deliveryError}</p>}
        </div>
      )}
    </div>
  );
}
