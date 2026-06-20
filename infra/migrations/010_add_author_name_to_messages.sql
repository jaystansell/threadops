-- 010: Add author_name to messages for agent display names

ALTER TABLE messages ADD COLUMN IF NOT EXISTS author_name text;
