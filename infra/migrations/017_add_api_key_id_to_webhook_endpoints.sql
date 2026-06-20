-- Add api_key_id column to webhook_endpoints so we can scope deliveries per agent.
-- Nullable: endpoints created via browser (cookie auth) have no api_key_id.
ALTER TABLE webhook_endpoints ADD COLUMN IF NOT EXISTS api_key_id uuid REFERENCES api_keys(id) ON DELETE SET NULL;

-- Backfill existing webhook endpoints: associate each endpoint with its agent's API key.
-- This uses the company_id to find matching API keys. If a company has exactly one
-- API key, we can safely assign it. If multiple keys exist, we leave it null and
-- the agent can re-register their webhook to get proper scoping.
UPDATE webhook_endpoints we
SET api_key_id = ak.id
FROM (
  SELECT company_id, id
  FROM api_keys
  WHERE company_id IN (
    SELECT company_id FROM api_keys GROUP BY company_id HAVING COUNT(*) = 1
  )
) ak
WHERE we.company_id = ak.company_id
  AND we.api_key_id IS NULL;
