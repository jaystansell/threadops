import { createWebhookEndpointRepo } from "../../adapters/supabase/webhook-endpoint-repo";
import type { SupabaseClient } from "../../adapters/supabase/client";
import type { AuthContext } from "../auth";
import type { CompanyId } from "../../core/types";

export async function listWebhooks(
  db: SupabaseClient,
  auth: AuthContext,
) {
  const repo = createWebhookEndpointRepo(db);
  return repo.listByCompany(auth.companyId as CompanyId);
}
