-- Backfill usage_logs from existing thread data.
-- For each thread that has an agent_api_key_id and at least 1 message,
-- insert one usage_log entry representing the historical context savings.
-- Uses the thread's created_at as the log timestamp.
-- Safe to re-run: skips threads that already have a usage_log entry.
-- Note: tokens_without and tokens_saved are generated columns (computed from message_count).

INSERT INTO usage_logs (api_key_id, company_id, thread_id, message_count, summary_tokens, model_tier, created_at)
SELECT
  t.agent_api_key_id,
  t.company_id,
  t.id,
  mc.msg_count::int,
  500,                                  -- summary_tokens (Threadzy summary size)
  COALESCE(ak.model_tier, 'standard'),
  t.created_at
FROM threads t
INNER JOIN api_keys ak ON ak.id = t.agent_api_key_id
CROSS JOIN LATERAL (
  SELECT COUNT(*) AS msg_count FROM messages m WHERE m.thread_id = t.id
) mc
WHERE mc.msg_count > 0
  AND NOT EXISTS (
    SELECT 1 FROM usage_logs ul WHERE ul.thread_id = t.id AND ul.api_key_id = t.agent_api_key_id
  );
