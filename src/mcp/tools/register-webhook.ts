import { v4 as uuidv4 } from "uuid";
import { createWebhookEndpointRepo } from "../../adapters/supabase/webhook-endpoint-repo";
import type { SupabaseClient } from "../../adapters/supabase/client";
import type { AuthContext } from "../auth";
import type { CompanyId, WebhookEndpointFilters } from "../../core/types";
import { ALWAYS_ON_EVENTS } from "../../core/types";

export interface RegisterWebhookInput {
  url: string;
  events: string[];
  filters?: WebhookEndpointFilters;
}

export async function registerWebhook(
  db: SupabaseClient,
  auth: AuthContext,
  input: RegisterWebhookInput,
) {
  const repo = createWebhookEndpointRepo(db);
  const mergedEvents = Array.from(
    new Set([...input.events, ...ALWAYS_ON_EVENTS]),
  );
  return repo.create({
    company_id: auth.companyId as CompanyId,
    api_key_id: auth.keyId,
    url: input.url,
    events: mergedEvents,
    secret: uuidv4(),
    ...(input.filters && { filters: input.filters }),
  });
}
