-- 037: Add columns for per-message delivery receipts
--
-- Links user messages directly to their outbound webhook delivery,
-- records ACK timestamps on deliveries, and tracks which message
-- is the agent's reply.

-- 1. messages.webhook_delivery_id — direct FK instead of payload->>message_id lookup
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS webhook_delivery_id uuid
    REFERENCES webhook_deliveries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_webhook_delivery_id
  ON messages(webhook_delivery_id)
  WHERE webhook_delivery_id IS NOT NULL;

-- 2. webhook_deliveries.ack_at — when the agent acknowledged the delivery
ALTER TABLE webhook_deliveries
  ADD COLUMN IF NOT EXISTS ack_at timestamptz;

-- 3. webhook_deliveries.reply_message_id — FK to the agent's reply message
ALTER TABLE webhook_deliveries
  ADD COLUMN IF NOT EXISTS reply_message_id uuid
    REFERENCES messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_reply_message_id
  ON webhook_deliveries(reply_message_id)
  WHERE reply_message_id IS NOT NULL;
