-- File attachments for thread messages
-- Free plan: 30-day retention, 10 MB max per file, 5 files per message

CREATE TABLE IF NOT EXISTS message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_size integer NOT NULL,
  content_type text NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  purged_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_attachments_message ON message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_thread ON message_attachments(thread_id);
CREATE INDEX IF NOT EXISTS idx_attachments_expires ON message_attachments(expires_at);

ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view attachments for their company" ON message_attachments;
CREATE POLICY "Users can view attachments for their company"
  ON message_attachments FOR SELECT
  USING (company_id IN (
    SELECT cm.company_id FROM company_members cm WHERE cm.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert attachments for their company" ON message_attachments;
CREATE POLICY "Users can insert attachments for their company"
  ON message_attachments FOR INSERT
  WITH CHECK (company_id IN (
    SELECT cm.company_id FROM company_members cm WHERE cm.user_id = auth.uid()
  ));

-- Storage bucket must be created via Supabase dashboard or CLI:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('thread-attachments', 'thread-attachments', false);
