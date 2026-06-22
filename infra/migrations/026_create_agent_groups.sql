-- Custom agent groups: users can organize agents into named groups
-- (e.g. "Work Agents", "Family Agents") for sidebar filtering.

CREATE TABLE IF NOT EXISTS agent_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'teal',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_groups_user ON agent_groups(user_id, company_id);

ALTER TABLE agent_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own groups" ON agent_groups;
CREATE POLICY "Users can manage their own groups"
  ON agent_groups FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Join table: which API keys (agents) belong to which group
CREATE TABLE IF NOT EXISTS agent_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES agent_groups(id) ON DELETE CASCADE,
  api_key_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, api_key_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_group_members_group ON agent_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_agent_group_members_key ON agent_group_members(api_key_id);

ALTER TABLE agent_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage members of their own groups" ON agent_group_members;
CREATE POLICY "Users can manage members of their own groups"
  ON agent_group_members FOR ALL
  USING (group_id IN (SELECT id FROM agent_groups WHERE user_id = auth.uid()))
  WITH CHECK (group_id IN (SELECT id FROM agent_groups WHERE user_id = auth.uid()));
