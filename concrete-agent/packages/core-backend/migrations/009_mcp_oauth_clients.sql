-- Migration 009: MCP Dynamic Client Registration (RFC 7591)
-- Self-registered OAuth clients with metadata for authorization_code
-- and client_credentials flows.
--
-- Used by /api/v1/mcp/oauth/register (RFC 7591 §3) to enable
-- Anthropic broker (claude.ai) + ChatGPT broker auto-registration —
-- without DCR, every user would need to manually provision
-- client_id/client_secret outside the OAuth dance, which neither
-- broker supports.
--
-- Separation from mcp_api_keys
-- ----------------------------
-- mcp_api_keys = end users (email + bcrypt password + credit balance).
-- mcp_oauth_clients = OAuth clients (broker software registrations).
-- They are *different concepts*: a single user may consent to multiple
-- clients; a single client may serve many users via authorization_code.
--
-- created_by_user_id (NULLABLE):
--   NULL                     → public DCR (no Authorization on /register).
--                              client_credentials issues tokens with
--                              user_api_key=NULL → 402 on paid tools.
--   <mcp_api_keys.id>        → authenticated DCR. client_credentials
--                              grant resolves user_api_key from this
--                              row so credits attribute to the
--                              registering user.
--
-- client_secret_hash + client_secret_salt:
--   SHA-256(salt || secret), salt = 16 random bytes (128-bit) hex.
--   bcrypt would be wasted CPU here: 192-bit entropy on the secret
--   itself, plus this hash is verified on every server-to-server
--   /token call (no offline attack surface).

CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
    id                    SERIAL PRIMARY KEY,
    client_id             TEXT NOT NULL UNIQUE,
    client_secret_hash    TEXT NOT NULL,
    client_secret_salt    TEXT NOT NULL,
    client_name           TEXT NOT NULL,
    redirect_uris         JSONB NOT NULL DEFAULT '[]'::jsonb,
    grant_types           JSONB NOT NULL DEFAULT '["authorization_code"]'::jsonb,
    scope                 TEXT,
    software_id           TEXT,
    software_version      TEXT,
    registration_source   TEXT NOT NULL DEFAULT 'dcr',
    registered_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    registered_ip         TEXT,
    registered_user_agent TEXT,
    created_by_user_id    INTEGER REFERENCES mcp_api_keys(id) ON DELETE SET NULL,
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_clients_client_id ON mcp_oauth_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_clients_created_by ON mcp_oauth_clients(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_clients_active ON mcp_oauth_clients(is_active) WHERE is_active = TRUE;

-- Audit log for registrations — INFO-level structured record per RFC 7591
-- §3.1 ("the authorization server SHOULD record a log entry"). Allows
-- security review of who registered what + when + from where.
CREATE TABLE IF NOT EXISTS mcp_oauth_registration_log (
    id                  SERIAL PRIMARY KEY,
    oauth_client_id     INTEGER NOT NULL REFERENCES mcp_oauth_clients(id) ON DELETE CASCADE,
    client_name         TEXT NOT NULL,
    registered_ip       TEXT,
    registered_user_agent TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_reg_log_client ON mcp_oauth_registration_log(oauth_client_id);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_reg_log_created ON mcp_oauth_registration_log(created_at);
