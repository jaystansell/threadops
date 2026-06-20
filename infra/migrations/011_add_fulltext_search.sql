-- 011: Add full-text search indexes for threads and messages

-- Add tsvector column to messages for full-text search
ALTER TABLE messages ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate existing rows
UPDATE messages SET search_vector = to_tsvector('english', coalesce(body, ''));

-- Create trigger to auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION messages_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.body, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_search_vector_trigger ON messages;
CREATE TRIGGER messages_search_vector_trigger
  BEFORE INSERT OR UPDATE OF body ON messages
  FOR EACH ROW EXECUTE FUNCTION messages_search_vector_update();

-- GIN index on messages search_vector
CREATE INDEX IF NOT EXISTS idx_messages_search_vector ON messages USING GIN (search_vector);

-- Add tsvector column to threads for title search
ALTER TABLE threads ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate existing rows
UPDATE threads SET search_vector = to_tsvector('english', coalesce(title, ''));

-- Create trigger to auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION threads_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.title, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS threads_search_vector_trigger ON threads;
CREATE TRIGGER threads_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title ON threads
  FOR EACH ROW EXECUTE FUNCTION threads_search_vector_update();

-- GIN index on threads search_vector
CREATE INDEX IF NOT EXISTS idx_threads_search_vector ON threads USING GIN (search_vector);
