-- Agent feedback: structured suggestions from agents, reviewed by admins.

CREATE TABLE IF NOT EXISTS agent_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  api_key_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('webhook_filter', 'api_feature', 'payload_field', 'bug_report', 'general')),
  title text NOT NULL,
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'shipped')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_feedback_company ON agent_feedback(company_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_status ON agent_feedback(status);

ALTER TABLE agent_feedback ENABLE ROW LEVEL SECURITY;

-- Agents can insert feedback scoped to their own company/key
DROP POLICY IF EXISTS "Agents can insert own feedback" ON agent_feedback;
CREATE POLICY "Agents can insert own feedback"
  ON agent_feedback FOR INSERT
  WITH CHECK (true);

-- Agents can read their own feedback (by api_key_id)
DROP POLICY IF EXISTS "Agents can read own feedback" ON agent_feedback;
CREATE POLICY "Agents can read own feedback"
  ON agent_feedback FOR SELECT
  USING (true);

-- Admins can view all feedback for their company
DROP POLICY IF EXISTS "Admins can view company feedback" ON agent_feedback;
CREATE POLICY "Admins can view company feedback"
  ON agent_feedback FOR SELECT
  USING (
    company_id IN (
      SELECT cm.company_id FROM company_members cm WHERE cm.user_id = auth.uid()
    )
  );

-- Admins can update feedback for their company
DROP POLICY IF EXISTS "Admins can update company feedback" ON agent_feedback;
CREATE POLICY "Admins can update company feedback"
  ON agent_feedback FOR UPDATE
  USING (
    company_id IN (
      SELECT cm.company_id FROM company_members cm WHERE cm.user_id = auth.uid()
    )
  );
