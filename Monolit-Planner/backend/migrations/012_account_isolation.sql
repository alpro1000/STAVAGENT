-- Migration 012: Account isolation — link projects to Portal user accounts
-- Date: 2026-03-31
-- Purpose: Each project belongs to a Portal user (via portal_user_id).
--          Authenticated requests filter by portal_user_id.
--          NULL = legacy kiosk project (visible only in unauthenticated mode).

-- ============================================
-- 1. ADD portal_user_id to monolith_projects
-- ============================================

-- portal_user_id stores the Portal users.id (INTEGER) from stavagent_portal DB.
-- Nullable: existing projects keep NULL (legacy kiosk mode).
ALTER TABLE monolith_projects ADD COLUMN IF NOT EXISTS portal_user_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_monolith_projects_portal_user
  ON monolith_projects(portal_user_id);

-- ============================================
-- 2. ADD portal_user_id to bridges (FK compat)
-- ============================================

ALTER TABLE bridges ADD COLUMN IF NOT EXISTS portal_user_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_bridges_portal_user
  ON bridges(portal_user_id);

-- ============================================
-- END OF MIGRATION 012
-- ============================================
