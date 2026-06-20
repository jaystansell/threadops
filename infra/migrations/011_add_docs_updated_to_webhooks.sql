-- Add docs.updated to all existing webhook endpoints that don't already have it.
-- This is a mandatory always-on event scope for keeping agents up to date
-- with API/MCP documentation changes.

UPDATE webhook_endpoints
SET events = array_append(events, 'docs.updated'),
    updated_at = now()
WHERE NOT ('docs.updated' = ANY(events));
