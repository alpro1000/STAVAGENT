-- Migration 011: MCP OAuth access + refresh tokens
-- Persistent token storage for tokens issued via /api/v1/mcp/oauth/token
-- by DCR-registered clients. Required because access_tokens can no
-- longer be aliased to the user's api_key once DCR is in play — the
-- middleware needs to resolve (user_api_key, oauth_client_id) on every
-- bearer presentation to attribute credits + enforce 402 for unbound
-- client_credentials grants.
--
-- Format
-- ------
-- access_token   = sat-{hex48}   (Stavagent Access Token, 192-bit entropy)
-- refresh_token  = srt-{hex48}   (NULL for client_credentials grant per
--                                  RFC 6749 §4.4.3)
--
-- TTLs
-- ----
-- access_expires_at  = issued_at + 3600s  (OAuth canon)
-- refresh_expires_at = issued_at + 90d    (canonical long-lived)
--
-- user_api_key (NULLABLE)
-- -----------------------
-- NULL          → client_credentials grant on a public-DCR client
--                  (mcp_oauth_clients.created_by_user_id IS NULL).
--                  Middleware enforces 402 Payment Required on paid
--                  tools — only discovery + free tools succeed.
-- <api_key>     → either:
--                  (a) authorization_code grant — value pulled from
--                      consume_code()'s user_api_key column
--                      (mcp_oauth_codes.client_id).
--                  (b) authenticated-DCR client_credentials —
--                      value resolved from mcp_oauth_clients
--                      .created_by_user_id → api_key.
--                  Either way, credits attribute to this user.
--
-- rotated_from
-- ------------
-- Refresh-token rotation per OAuth 2.0 BCP §4.14: each /token call
-- with grant_type=refresh_token issues a NEW access+refresh pair and
-- sets rotated_from := old token id, marks old refresh_token as
-- revoked. Stolen-token detection: if a revoked refresh token is
-- replayed, ALL descendants in the rotation chain are revoked.

CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
    id                  SERIAL PRIMARY KEY,
    access_token        TEXT NOT NULL UNIQUE,
    refresh_token       TEXT UNIQUE,
    oauth_client_id     TEXT NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
    user_api_key        TEXT REFERENCES mcp_api_keys(api_key) ON DELETE CASCADE,
    grant_type          TEXT NOT NULL,
    scope               TEXT,
    issued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    access_expires_at   TIMESTAMPTZ NOT NULL,
    refresh_expires_at  TIMESTAMPTZ,
    revoked_at          TIMESTAMPTZ,
    rotated_from        INTEGER REFERENCES mcp_oauth_tokens(id) ON DELETE SET NULL,
    last_used_at        TIMESTAMPTZ
);

-- Bearer lookup path: middleware does
--   SELECT user_api_key, oauth_client_id, access_expires_at, revoked_at
--   FROM mcp_oauth_tokens WHERE access_token = $1
-- on every authenticated /mcp/* request. Indexed for O(log n).
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_access ON mcp_oauth_tokens(access_token);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_refresh ON mcp_oauth_tokens(refresh_token) WHERE refresh_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_user ON mcp_oauth_tokens(user_api_key) WHERE user_api_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_client ON mcp_oauth_tokens(oauth_client_id);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_expires ON mcp_oauth_tokens(access_expires_at);
