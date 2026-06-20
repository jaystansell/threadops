-- 014: Add summary text column to threads

ALTER TABLE threads ADD COLUMN IF NOT EXISTS summary text;
