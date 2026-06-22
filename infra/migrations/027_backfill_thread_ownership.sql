-- Backfill agent_api_key_id for threads created by agents that are missing ownership.
-- Root cause: threads created before ownership feature was deployed have NULL agent_api_key_id
-- even though created_by points to a valid api_keys.id.
-- This caused webhooks to broadcast to ALL agents instead of only the owning agent (P0 bug).

UPDATE threads t
SET agent_api_key_id = t.created_by
WHERE t.agent_api_key_id IS NULL
  AND EXISTS (
    SELECT 1 FROM api_keys ak WHERE ak.id = t.created_by
  );
