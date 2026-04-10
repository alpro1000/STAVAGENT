-- Migration 007: MCP API Keys + Credits
-- API key management for MCP tool access with credit-based billing.

CREATE TABLE IF NOT EXISTS mcp_api_keys (
    id SERIAL PRIMARY KEY,
    user_email TEXT NOT NULL UNIQUE,
    api_key TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    credits INTEGER NOT NULL DEFAULT 200,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    total_credits_used INTEGER NOT NULL DEFAULT 0,
    total_credits_purchased INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_key ON mcp_api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_email ON mcp_api_keys(user_email);

-- Credit transaction log for audit trail
CREATE TABLE IF NOT EXISTS mcp_credit_log (
    id SERIAL PRIMARY KEY,
    api_key_id INTEGER NOT NULL REFERENCES mcp_api_keys(id),
    tool_name TEXT NOT NULL,
    credits_used INTEGER NOT NULL,
    credits_remaining INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_credit_log_key_id ON mcp_credit_log(api_key_id);
CREATE INDEX IF NOT EXISTS idx_mcp_credit_log_created ON mcp_credit_log(created_at);
