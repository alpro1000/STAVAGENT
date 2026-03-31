-- Migration 012: Add portal_user_id to monolith_projects
-- Date: 2026-03-31
-- Purpose: Fix "column portal_user_id does not exist" error on production
--
-- Root cause: production DB received a request referencing portal_user_id
-- but the column was never added to the schema. Adding as nullable TEXT
-- column for future portal user association (anonymous projects = NULL).

-- PostgreSQL
ALTER TABLE monolith_projects ADD COLUMN IF NOT EXISTS portal_user_id TEXT;

-- Index for looking up projects by portal user
CREATE INDEX IF NOT EXISTS idx_monolith_projects_portal_user ON monolith_projects(portal_user_id);
