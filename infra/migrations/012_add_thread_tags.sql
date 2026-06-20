-- 012: Add thread tags table

CREATE TABLE IF NOT EXISTS thread_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(thread_id, tag)
);

-- Index for efficient tag lookups
CREATE INDEX IF NOT EXISTS idx_thread_tags_thread_id ON thread_tags(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_tags_tag ON thread_tags(tag);

-- Enable RLS
ALTER TABLE thread_tags ENABLE ROW LEVEL SECURITY;

-- RLS policy: allow all operations for authenticated users (company scoping handled at app layer via thread join)
CREATE POLICY "thread_tags_all" ON thread_tags FOR ALL USING (true) WITH CHECK (true);
