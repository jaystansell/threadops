-- 023: Message attachments

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
  purged_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_message_attachments_message ON message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_thread ON message_attachments(thread_id);

ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- Members can view attachments on threads in their company
DROP POLICY IF EXISTS "Members can view attachments" ON message_attachments;
CREATE POLICY "Members can view attachments"
  ON message_attachments FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
    )
  );

-- Members can insert attachments on threads in their company
DROP POLICY IF EXISTS "Members can insert attachments" ON message_attachments;
CREATE POLICY "Members can insert attachments"
  ON message_attachments FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
    )
  );

-- Note: purge operations use the service role key which bypasses RLS entirely.
-- No UPDATE policy needed; omitting prevents any authenticated user from
-- modifying attachment rows.
DROP POLICY IF EXISTS "Service can update attachments" ON message_attachments;
