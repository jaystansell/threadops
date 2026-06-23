-- Saved prompts: user-created prompt templates scoped to specific agents or all agents
CREATE TABLE IF NOT EXISTS saved_prompts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  body        text NOT NULL,
  agent_scope jsonb NOT NULL DEFAULT '{"all": true}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by owner
CREATE INDEX IF NOT EXISTS idx_saved_prompts_user_id ON saved_prompts(user_id);

-- Auto-update updated_at on row changes
DROP TRIGGER IF EXISTS set_saved_prompts_updated_at ON saved_prompts;
CREATE TRIGGER set_saved_prompts_updated_at
  BEFORE UPDATE ON saved_prompts
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- RLS: users can only access their own prompts
ALTER TABLE saved_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own prompts" ON saved_prompts;
CREATE POLICY "Users can view own prompts"
  ON saved_prompts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own prompts" ON saved_prompts;
CREATE POLICY "Users can insert own prompts"
  ON saved_prompts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own prompts" ON saved_prompts;
CREATE POLICY "Users can update own prompts"
  ON saved_prompts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own prompts" ON saved_prompts;
CREATE POLICY "Users can delete own prompts"
  ON saved_prompts FOR DELETE
  USING (auth.uid() = user_id);
