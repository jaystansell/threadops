-- 032: Add include_context boolean to webhook_endpoints
-- Allows agents to opt out of enriched context in webhook payloads

ALTER TABLE webhook_endpoints ADD COLUMN IF NOT EXISTS include_context boolean NOT NULL DEFAULT true;
