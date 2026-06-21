-- Add action.requested to all existing webhook endpoints' events arrays
UPDATE webhook_endpoints
SET events = events || '["action.requested"]'::jsonb
WHERE NOT events ? 'action.requested';
