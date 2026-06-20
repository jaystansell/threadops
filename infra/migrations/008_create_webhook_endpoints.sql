CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  secret text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can view their webhook endpoints" ON webhook_endpoints;
CREATE POLICY "Company members can view their webhook endpoints"
  ON webhook_endpoints FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company members can insert webhook endpoints" ON webhook_endpoints;
CREATE POLICY "Company members can insert webhook endpoints"
  ON webhook_endpoints FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company members can update their webhook endpoints" ON webhook_endpoints;
CREATE POLICY "Company members can update their webhook endpoints"
  ON webhook_endpoints FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company members can delete their webhook endpoints" ON webhook_endpoints;
CREATE POLICY "Company members can delete their webhook endpoints"
  ON webhook_endpoints FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_company ON webhook_endpoints(company_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_active ON webhook_endpoints(company_id, active);
