-- 020: Add created_by column to api_keys for per-user key isolation

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE INDEX IF NOT EXISTS idx_api_keys_created_by ON api_keys(created_by);
