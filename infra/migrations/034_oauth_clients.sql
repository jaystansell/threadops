-- Dynamic OAuth client registration (RFC 7591)
-- MCP clients like Tasklet register themselves automatically during OAuth discovery.

CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id       TEXT PRIMARY KEY,
  client_id_issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_name     TEXT,
  redirect_uris   TEXT[] NOT NULL DEFAULT '{}',
  grant_types     TEXT[] NOT NULL DEFAULT '{authorization_code}',
  response_types  TEXT[] NOT NULL DEFAULT '{code}',
  token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
  scope           TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_clients_created
  ON oauth_clients(created_at);
