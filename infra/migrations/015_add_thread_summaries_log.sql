-- 015: Add thread_summaries log table for summary history

CREATE TABLE IF NOT EXISTS thread_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  summary text NOT NULL,
  author_kind text NOT NULL DEFAULT 'user',
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_thread_summaries_thread_id ON thread_summaries(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_summaries_created_at ON thread_summaries(thread_id, created_at DESC);
