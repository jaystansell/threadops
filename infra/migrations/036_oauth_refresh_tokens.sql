-- OAuth refresh tokens for long-lived MCP client sessions.
-- Issued alongside access tokens during authorization_code exchange.
-- Used with grant_type=refresh_token to obtain new access tokens.

CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash    TEXT NOT NULL UNIQUE,
  api_key_id    UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL,
  client_id     TEXT NOT NULL,
  scope         TEXT NOT NULL DEFAULT '',
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_hash
  ON oauth_refresh_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_expires
  ON oauth_refresh_tokens(expires_at);

-- Update cleanup function to also purge expired/revoked refresh tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_data()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM oauth_authorization_codes
  WHERE expires_at < NOW() - INTERVAL '1 hour';
  DELETE FROM oauth_access_tokens
  WHERE expires_at < NOW();
  DELETE FROM oauth_refresh_tokens
  WHERE expires_at < NOW() OR revoked_at IS NOT NULL;
$$;
