import { redirect } from "next/navigation";
import { createServerClient } from "@/adapters/supabase/client";
import { getAdminUser } from "@/adapters/supabase/auth/require-admin";
import type { AgentFeedback, ApiKey } from "@/core/types";
import { FeedbackDashboardClient } from "../_components/feedback-dashboard-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Agent Feedback" };

export default async function FeedbackPage() {
  const result = await getAdminUser();
  if (result.status !== "ok") redirect("/threads");

  const db = createServerClient();

  const [feedbackResult, keysResult] = await Promise.all([
    db
      .from("agent_feedback")
      .select("*")
      .eq("company_id", result.user.companyId)
      .order("created_at", { ascending: false }),
    db
      .from("api_keys")
      .select("id, label")
      .eq("company_id", result.user.companyId),
  ]);

  const feedback = (feedbackResult.data ?? []) as AgentFeedback[];
  const apiKeys = (keysResult.data ?? []) as Pick<ApiKey, "id" | "label">[];

  const keyLabelMap: Record<string, string> = {};
  for (const k of apiKeys) {
    keyLabelMap[k.id] = k.label;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 w-full space-y-4">
      <h2 className="text-xl font-bold">Agent Feedback</h2>
      <FeedbackDashboardClient
        initialFeedback={feedback}
        keyLabelMap={keyLabelMap}
      />
    </div>
  );
}
