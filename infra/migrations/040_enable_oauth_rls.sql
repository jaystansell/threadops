-- 040: Enable RLS on OAuth tables
--
-- These four tables had no RLS policies (marked UNRESTRICTED in Supabase
-- dashboard). Without RLS any authenticated user with the anon key could
-- read/write all rows. Enabling RLS with no permissive policies means only
-- the service-role client (which bypasses RLS) can access them, matching
-- the app's server-side-only usage pattern.

ALTER TABLE IF EXISTS oauth_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS oauth_authorization_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS oauth_refresh_tokens ENABLE ROW LEVEL SECURITY;
