-- Associate outbound delivery records with the endpoint that received them.
ALTER TABLE webhook_deliveries
  ADD COLUMN IF NOT EXISTS endpoint_id uuid
    REFERENCES webhook_endpoints(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint
  ON webhook_deliveries(endpoint_id, created_at DESC);
