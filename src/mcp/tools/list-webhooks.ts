import { createWebhookEndpointRepo } from "../../adapters/supabase/webhook-endpoint-repo";
import type { SupabaseClient } from "../../adapters/supabase/client";
import type { AuthContext } from "../auth";
import type { CompanyId } from "../../core/types";
import { getWebhookHealth, addWebhookWarnings } from "./webhook-health";

export async function listWebhooks(
  db: SupabaseClient,
  auth: AuthContext,
) {
  const repo = createWebhookEndpointRepo(db);
  const endpoints = await repo.listByAgent(auth.companyId as CompanyId, auth.keyId);
  const health = await getWebhookHealth(db, auth);
  return addWebhookWarnings(endpoints, health);
}
