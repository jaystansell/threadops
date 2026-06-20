-- 013: Add metadata JSONB column to threads

ALTER TABLE threads ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_threads_metadata ON threads USING GIN (metadata);
