import { v4 as uuidv4 } from "uuid";
import { createWebhookEndpointRepo } from "../../adapters/supabase/webhook-endpoint-repo";
import type { SupabaseClient } from "../../adapters/supabase/client";
import type { AuthContext } from "../auth";
import type { CompanyId } from "../../core/types";

export interface RegisterWebhookInput {
  url: string;
  events: string[];
}

export async function registerWebhook(
  db: SupabaseClient,
  auth: AuthContext,
  input: RegisterWebhookInput,
) {
  const repo = createWebhookEndpointRepo(db);
  return repo.create({
    company_id: auth.companyId as CompanyId,
    url: input.url,
    events: input.events,
    secret: uuidv4(),
  });
}
