-- 030: Deactivate webhook endpoints belonging to revoked API keys.
-- Previously, revoking an API key only set revoked_at on api_keys but left
-- the agent's webhook endpoints active, causing noisy deliveries to dead agents.

UPDATE webhook_endpoints
SET    active = false,
       updated_at = now()
WHERE  api_key_id IN (
         SELECT id FROM api_keys WHERE revoked_at IS NOT NULL
       )
AND    active = true;
