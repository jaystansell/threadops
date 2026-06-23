-- Add metadata column to messages for storing API call details
-- (endpoint, masked API key prefix, request/response context)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT NULL;
