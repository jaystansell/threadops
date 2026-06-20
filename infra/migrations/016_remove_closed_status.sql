-- Migrate any threads with status='closed' to status='archived'
-- The 'closed' status is being removed; only 'open' and 'archived' remain.
UPDATE threads SET status = 'archived' WHERE status = 'closed';
