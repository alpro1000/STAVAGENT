-- Migration 008: MCP OAuth authorization_code + PKCE
-- RFC 6749 §4.1 (authorization_code grant) + RFC 7636 (PKCE).
--
-- Used by ChatGPT custom connectors and Claude.ai MCP integration when
-- the user pastes a redirect URI + clicks "Authorize" in the third-party
-- UI. The /api/v1/mcp/oauth/authorize endpoint generates a short-lived
-- code stored here; the /api/v1/mcp/oauth/token endpoint exchanges it
-- for the user's API key after verifying SHA256(code_verifier) ==
-- code_challenge.
--
-- Single-user MCP model: client_id is the user's API key
-- (mcp_api_keys.api_key); FK cascade on user deactivation/deletion.

CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
    code                  TEXT PRIMARY KEY,
    client_id             TEXT NOT NULL REFERENCES mcp_api_keys(api_key) ON DELETE CASCADE,
    redirect_uri          TEXT NOT NULL,
    code_challenge        TEXT NOT NULL,
    code_challenge_method TEXT NOT NULL DEFAULT 'S256',
    state                 TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at            TIMESTAMPTZ NOT NULL,
    used_at               TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_client_id ON mcp_oauth_codes(client_id);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_expires_at ON mcp_oauth_codes(expires_at);
