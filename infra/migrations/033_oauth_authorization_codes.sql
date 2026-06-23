-- OAuth authorization codes for authorization_code + PKCE flow
-- Used by MCP clients (like Tasklet) that need interactive OAuth login

CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  code        TEXT PRIMARY KEY,
  client_id   TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  api_key_id  UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  scope       TEXT NOT NULL DEFAULT '',
  user_id     UUID NOT NULL,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires
  ON oauth_authorization_codes(expires_at);

-- OAuth access tokens issued via authorization_code flow.
-- Maps an opaque token hash back to the API key it was authorized against.
-- The MCP auth middleware checks this table in addition to api_keys.
CREATE TABLE IF NOT EXISTS oauth_access_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash  TEXT NOT NULL UNIQUE,
  api_key_id  UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  scope       TEXT NOT NULL DEFAULT '',
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_hash
  ON oauth_access_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_expires
  ON oauth_access_tokens(expires_at);

-- Automatic cleanup function for expired codes and tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_data()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM oauth_authorization_codes
  WHERE expires_at < NOW() - INTERVAL '1 hour';
  DELETE FROM oauth_access_tokens
  WHERE expires_at < NOW();
$$;
