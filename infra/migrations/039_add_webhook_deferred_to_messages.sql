-- 039: Track deferred webhook state on messages
--
-- When a message is created with has_pending_attachments: true the webhook
-- is deferred until attachments upload. This flag lets the /ready endpoint
-- atomically claim the dispatch (flip true → false) so repeated calls
-- cannot fire duplicate webhooks.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS webhook_deferred boolean NOT NULL DEFAULT false;
