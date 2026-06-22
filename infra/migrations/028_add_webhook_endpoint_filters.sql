-- Add filters column to webhook_endpoints for author_kind filtering
-- Run this in the Supabase SQL Editor
ALTER TABLE webhook_endpoints ADD COLUMN IF NOT EXISTS filters jsonb NOT NULL DEFAULT '{}'::jsonb;
