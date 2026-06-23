-- Add configurable ACK timeout per company (default 60 seconds)
alter table companies add column if not exists ack_timeout_seconds integer not null default 60;
