-- Migration 010: Extend mcp_oauth_codes for DCR-issued clients
-- Adds oauth_client_id column so PKCE codes can bind to the OAuth
-- client (mcp_oauth_clients) that initiated the authorize flow —
-- separately from client_id (= user api_key granting consent).
--
-- Backward-compat
-- ---------------
-- Column is NULLABLE: existing rows (pre-DCR ChatGPT custom GPT flow
-- where client_id literally equals the user's api_key) keep
-- oauth_client_id = NULL. The token endpoint detects this case and
-- falls back to legacy semantics: access_token := api_key, no row
-- inserted into mcp_oauth_tokens, paid tools attribute credits to
-- that api_key directly.
--
-- New DCR rows
-- ------------
-- For DCR-issued clients running authorization_code:
--   client_id        = user's api_key (consent grantor) — unchanged FK.
--   oauth_client_id  = dcr-{hex24} from mcp_oauth_clients.client_id —
--                      whom the broker authenticated as on /token.
-- consume_code() in oauth_codes.py returns both columns so
-- /token can mint an mcp_oauth_tokens row with (user_api_key,
-- oauth_client_id) binding.

ALTER TABLE mcp_oauth_codes
    ADD COLUMN IF NOT EXISTS oauth_client_id TEXT;

-- FK ON DELETE SET NULL: deactivating a DCR client should not orphan
-- pending codes, but the code becomes invalid (consume_code rejects
-- NULL→non-NULL transition on already-issued codes).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'mcp_oauth_codes_oauth_client_id_fkey'
          AND table_name = 'mcp_oauth_codes'
    ) THEN
        ALTER TABLE mcp_oauth_codes
            ADD CONSTRAINT mcp_oauth_codes_oauth_client_id_fkey
            FOREIGN KEY (oauth_client_id)
            REFERENCES mcp_oauth_clients(client_id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_oauth_client_id
    ON mcp_oauth_codes(oauth_client_id);
