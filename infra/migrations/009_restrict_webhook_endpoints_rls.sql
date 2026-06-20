-- Restrict webhook_endpoints to owner/admin roles only (matches api_keys and webhook_deliveries)
-- and add the missing set_updated_at trigger.

-- SELECT
DROP POLICY IF EXISTS "Company members can view their webhook endpoints" ON webhook_endpoints;
CREATE POLICY "Admins can view webhook endpoints" ON webhook_endpoints FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- INSERT
DROP POLICY IF EXISTS "Company members can insert webhook endpoints" ON webhook_endpoints;
CREATE POLICY "Admins can insert webhook endpoints" ON webhook_endpoints FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- UPDATE
DROP POLICY IF EXISTS "Company members can update their webhook endpoints" ON webhook_endpoints;
CREATE POLICY "Admins can update webhook endpoints" ON webhook_endpoints FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- DELETE
DROP POLICY IF EXISTS "Company members can delete their webhook endpoints" ON webhook_endpoints;
CREATE POLICY "Admins can delete webhook endpoints" ON webhook_endpoints FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Add missing set_updated_at trigger
DROP TRIGGER IF EXISTS webhook_endpoints_set_updated_at ON webhook_endpoints;
CREATE TRIGGER webhook_endpoints_set_updated_at
  BEFORE UPDATE ON webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
