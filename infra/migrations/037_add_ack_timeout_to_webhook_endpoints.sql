-- Add configurable ACK timeout per webhook endpoint (default 60 seconds).
-- When set, the cron job uses this value to determine how long an agent has
-- to ACK after a successful delivery before the thread is marked "unhandled".
alter table webhook_endpoints
  add column if not exists ack_timeout_seconds integer not null default 60;
