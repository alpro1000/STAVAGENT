-- Google Drive Integration - Database Schema
-- Version: 1.0.0
-- Created: 2026-01-13

-- ==================== Google Credentials Table ====================

-- Stores encrypted OAuth2 credentials for users
CREATE TABLE IF NOT EXISTS google_credentials (
    -- Primary key
    user_id TEXT PRIMARY KEY,

    -- OAuth2 tokens (encrypted with Fernet)
    access_token TEXT NOT NULL,
    refresh_token TEXT,  -- NULL if user revoked or offline_access not granted
    token_expiry TIMESTAMP,

    -- Scopes granted by user
    scopes TEXT NOT NULL,  -- JSON array: ["https://www.googleapis.com/auth/drive.file"]

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_google_credentials_user_id
ON google_credentials(user_id);

-- Index for expiry checks
CREATE INDEX IF NOT EXISTS idx_google_credentials_expiry
ON google_credentials(token_expiry);


-- ==================== Google Webhooks Table ====================

-- Stores active webhooks for folder monitoring
CREATE TABLE IF NOT EXISTS google_webhooks (
    -- Primary key
    channel_id TEXT PRIMARY KEY,

    -- Foreign keys
    user_id TEXT NOT NULL,
    project_id TEXT NOT NULL,  -- STAVAGENT project ID
    folder_id TEXT NOT NULL,   -- Google Drive folder ID

    -- Google webhook details
    resource_id TEXT NOT NULL,  -- Google resource ID
    expiration INTEGER NOT NULL,  -- Unix timestamp (milliseconds)

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraints (optional, depends on your schema)
    -- FOREIGN KEY (user_id) REFERENCES google_credentials(user_id) ON DELETE CASCADE,
    -- FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

-- Index for project lookups
CREATE INDEX IF NOT EXISTS idx_google_webhooks_project_id
ON google_webhooks(project_id);

-- Index for folder lookups
CREATE INDEX IF NOT EXISTS idx_google_webhooks_folder_id
ON google_webhooks(folder_id);

-- Index for expiry checks (cleanup cron job)
CREATE INDEX IF NOT EXISTS idx_google_webhooks_expiration
ON google_webhooks(expiration);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_google_webhooks_user_id
ON google_webhooks(user_id);


-- ==================== Example Queries ====================

-- Get user credentials
-- SELECT access_token, refresh_token, token_expiry, scopes
-- FROM google_credentials
-- WHERE user_id = 'user_123';

-- Get active webhooks for project
-- SELECT channel_id, folder_id, expiration
-- FROM google_webhooks
-- WHERE project_id = 'project_456'
-- AND expiration > strftime('%s', 'now') * 1000;

-- Get expired webhooks (for cleanup)
-- SELECT channel_id, folder_id
-- FROM google_webhooks
-- WHERE expiration < strftime('%s', 'now') * 1000;

-- Delete user credentials (cascade delete webhooks if FK constraint exists)
-- DELETE FROM google_credentials WHERE user_id = 'user_123';
