-- 008: Thread Ownership
-- Agents only see/write to threads they created.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'threads' AND column_name = 'agent_api_key_id'
  ) THEN
    ALTER TABLE threads ADD COLUMN agent_api_key_id uuid REFERENCES api_keys(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_threads_agent_key ON threads(agent_api_key_id);
