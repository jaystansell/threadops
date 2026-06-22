-- Add shared_at column to track when user confirmed they shared the key with their agent.
-- Used by the webhook monitoring flow: after shared_at is set, we check for 5 min
-- whether the agent registered a webhook, and send daily reminder emails if not.
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS shared_at timestamptz;
