-- Add action.requested to all existing webhook endpoints' events arrays
UPDATE webhook_endpoints
SET events = array_append(events, 'action.requested')
WHERE NOT ('action.requested' = ANY(events));
